package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/shirajitsu/claim-extractor/internal/domain"
)

const defaultAnthropicBase = "https://api.anthropic.com"

type AnthropicProvider struct {
	cfg    Config
	client *http.Client
}

func NewAnthropicProvider(cfg Config) *AnthropicProvider {
	return &AnthropicProvider{cfg: cfg, client: &http.Client{}}
}

func (p *AnthropicProvider) Extract(ctx context.Context, text string) ([]domain.Claim, error) {
	base := p.cfg.BaseURL
	if base == "" {
		base = defaultAnthropicBase
	}

	body := map[string]any{
		"model":      p.cfg.Model,
		"max_tokens": 4096,
		"system":     SystemPrompt,
		"messages": []map[string]string{
			{"role": "user", "content": fmt.Sprintf(UserPromptTemplate, text)},
		},
	}

	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1/messages", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anthropic request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("anthropic returned %d", resp.StatusCode)
	}

	var result struct {
		Content []struct{ Text string `json:"text"` } `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode anthropic response: %w", err)
	}
	if len(result.Content) == 0 {
		return nil, fmt.Errorf("empty anthropic response")
	}

	return parseClaims(result.Content[0].Text)
}
