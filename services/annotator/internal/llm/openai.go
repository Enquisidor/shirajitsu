package llm

import (
	"context"
	"fmt"
	"net/http"
)

// OpenAIProvider is a stub — not yet implemented.
type OpenAIProvider struct {
	cfg    Config
	client *http.Client
}

func NewOpenAIProvider(cfg Config) *OpenAIProvider {
	return &OpenAIProvider{cfg: cfg, client: &http.Client{}}
}

func (p *OpenAIProvider) Name() string { return "openai" }

func (p *OpenAIProvider) Score(_ context.Context, _ string, _ []SourceSummary) ([]SourceScore, Usage, error) {
	return nil, Usage{}, fmt.Errorf("not yet implemented")
}
