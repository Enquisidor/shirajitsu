package claude

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/shirajitsu/claim-extractor/internal/domain"
)

const model = "claude-sonnet-4-20250514"

const systemPrompt = `You are a factual claim analyst. Your job is to identify discrete, checkable factual claims in text.

A checkable factual claim is a specific assertion about the world that could in principle be verified or contradicted by evidence.
Do NOT include: opinions, value judgements, framings, rhetorical assertions, predictions, or normative statements.

Return ONLY valid JSON — an array of claim objects. No prose, no markdown fences.`

const userPromptTemplate = `Identify all checkable factual claims in the following text. For each claim return:
- claimText: the exact claim as a string
- charOffset: approximate character position in the original text (integer)
- charLength: length of the claim text in characters (integer)
- riskLevel: "high" | "medium" | "low" based on how likely the claim is to have contradicting sources
- riskReasoning: one sentence explaining the risk level
- searchQuery: an optimised web search query to verify this claim

Text:
"""
%s
"""`

type claudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	System    string          `json:"system"`
	Messages  []claudeMessage `json:"messages"`
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}

// Extractor calls the Claude API to extract claims from text.
type Extractor struct {
	apiKey string
	client *http.Client
}

func NewExtractor(apiKey string) *Extractor {
	if apiKey == "" {
		apiKey = os.Getenv("CLAUDE_API_KEY")
	}
	return &Extractor{apiKey: apiKey, client: &http.Client{}}
}

func (e *Extractor) Extract(ctx context.Context, text string) ([]domain.Claim, error) {
	body := claudeRequest{
		Model:     model,
		MaxTokens: 4096,
		System:    systemPrompt,
		Messages: []claudeMessage{
			{Role: "user", Content: fmt.Sprintf(userPromptTemplate, text)},
		},
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", e.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("claude api call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("claude api returned %d", resp.StatusCode)
	}

	var claudeResp claudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(claudeResp.Content) == 0 {
		return nil, fmt.Errorf("empty response from claude")
	}

	var claims []domain.Claim
	if err := json.Unmarshal([]byte(claudeResp.Content[0].Text), &claims); err != nil {
		return nil, fmt.Errorf("parse claims json: %w", err)
	}

	return claims, nil
}
