package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/shirajitsu/claim-extractor/internal/domain"
)

const defaultOllamaBase = "http://localhost:11434"

// OllamaProvider supports local self-hosted models via the Ollama API.
type OllamaProvider struct {
	cfg    Config
	client *http.Client
}

func NewOllamaProvider(cfg Config) *OllamaProvider {
	return &OllamaProvider{cfg: cfg, client: &http.Client{}}
}

func (p *OllamaProvider) Extract(ctx context.Context, text string) ([]domain.Claim, error) {
	base := p.cfg.BaseURL
	if base == "" {
		base = defaultOllamaBase
	}

	model := p.cfg.Model
	if model == "" {
		model = "llama3"
	}

	prompt := SystemPrompt + "\n\n" + fmt.Sprintf(UserPromptTemplate, text)

	body := map[string]any{
		"model":  model,
		"prompt": prompt,
		"format": "json",
		"stream": false,
	}

	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/generate", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ollama request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama returned %d", resp.StatusCode)
	}

	var result struct {
		Response string `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode ollama response: %w", err)
	}

	return parseClaims(result.Response)
}
