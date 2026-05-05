package llm

import (
	"context"
	"fmt"
	"net/http"
)

// OllamaProvider is a stub — not yet implemented.
type OllamaProvider struct {
	cfg    Config
	client *http.Client
}

func NewOllamaProvider(cfg Config) *OllamaProvider {
	return &OllamaProvider{cfg: cfg, client: &http.Client{}}
}

func (p *OllamaProvider) Name() string { return "ollama" }

func (p *OllamaProvider) Score(_ context.Context, _ string, _ []SourceSummary) ([]SourceScore, Usage, error) {
	return nil, Usage{}, fmt.Errorf("not yet implemented")
}
