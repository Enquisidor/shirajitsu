package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

const defaultAnthropicBase = "https://api.anthropic.com"

// AnthropicProvider implements Provider using the Anthropic Messages API.
type AnthropicProvider struct {
	cfg    Config
	client *http.Client
}

func NewAnthropicProvider(cfg Config) *AnthropicProvider {
	return &AnthropicProvider{cfg: cfg, client: &http.Client{}}
}

func (p *AnthropicProvider) Name() string { return "anthropic" }

func (p *AnthropicProvider) Score(ctx context.Context, claimText string, sources []SourceSummary) ([]SourceScore, Usage, error) {
	base := p.cfg.BaseURL
	if base == "" {
		base = defaultAnthropicBase
	}

	body := map[string]any{
		"model":      p.cfg.Model,
		"max_tokens": 4096,
		"system":     SystemPrompt,
		"messages": []map[string]string{
			{"role": "user", "content": buildUserPrompt(claimText, sources)},
		},
	}

	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1/messages", bytes.NewReader(payload))
	if err != nil {
		return nil, Usage{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, Usage{}, fmt.Errorf("anthropic request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, Usage{}, fmt.Errorf("anthropic returned %d", resp.StatusCode)
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, Usage{}, fmt.Errorf("decode anthropic response: %w", err)
	}
	if len(result.Content) == 0 {
		return nil, Usage{}, fmt.Errorf("empty anthropic response")
	}

	scores, err := parseSourceScores(result.Content[0].Text)
	if err != nil {
		return nil, Usage{}, err
	}

	usage := Usage{
		InputTokens:  result.Usage.InputTokens,
		OutputTokens: result.Usage.OutputTokens,
	}
	return scores, usage, nil
}
