package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/shirajitsu/claim-extractor/internal/domain"
)

const defaultGoogleBase = "https://generativelanguage.googleapis.com"

type GoogleProvider struct {
	cfg    Config
	client *http.Client
}

func NewGoogleProvider(cfg Config) *GoogleProvider {
	return &GoogleProvider{cfg: cfg, client: &http.Client{}}
}

func (p *GoogleProvider) Extract(ctx context.Context, text string) ([]domain.Claim, error) {
	base := p.cfg.BaseURL
	if base == "" {
		base = defaultGoogleBase
	}

	model := p.cfg.Model
	if model == "" {
		model = "gemini-1.5-pro"
	}

	body := map[string]any{
		"system_instruction": map[string]any{
			"parts": []map[string]string{{"text": SystemPrompt}},
		},
		"contents": []map[string]any{
			{"role": "user", "parts": []map[string]string{
				{"text": fmt.Sprintf(UserPromptTemplate, text)},
			}},
		},
		"generationConfig": map[string]any{
			"responseMimeType": "application/json",
		},
	}

	payload, _ := json.Marshal(body)
	url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", base, model, p.cfg.APIKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google returned %d", resp.StatusCode)
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct{ Text string `json:"text"` } `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode google response: %w", err)
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty google response")
	}

	return parseClaims(result.Candidates[0].Content.Parts[0].Text)
}
