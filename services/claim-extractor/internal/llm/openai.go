package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/shirajitsu/claim-extractor/internal/domain"
)

const defaultOpenAIBase = "https://api.openai.com"

type OpenAIProvider struct {
	cfg    Config
	client *http.Client
}

func NewOpenAIProvider(cfg Config) *OpenAIProvider {
	return &OpenAIProvider{cfg: cfg, client: &http.Client{}}
}

func (p *OpenAIProvider) Extract(ctx context.Context, text string) ([]domain.Claim, error) {
	base := p.cfg.BaseURL
	if base == "" {
		base = defaultOpenAIBase
	}

	body := map[string]any{
		"model": p.cfg.Model,
		"messages": []map[string]string{
			{"role": "system", "content": SystemPrompt},
			{"role": "user", "content": fmt.Sprintf(UserPromptTemplate, text)},
		},
		"max_tokens":      4096,
		"response_format": map[string]string{"type": "json_object"},
	}

	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.cfg.APIKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openai returned %d", resp.StatusCode)
	}

	var result struct {
		Choices []struct {
			Message struct{ Content string `json:"content"` } `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode openai response: %w", err)
	}
	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("empty openai response")
	}

	return parseClaims(result.Choices[0].Message.Content)
}
