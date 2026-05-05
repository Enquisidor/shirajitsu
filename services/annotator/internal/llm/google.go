package llm

import (
	"context"
	"fmt"
	"net/http"
)

// GoogleProvider is a stub — not yet implemented.
type GoogleProvider struct {
	cfg    Config
	client *http.Client
}

func NewGoogleProvider(cfg Config) *GoogleProvider {
	return &GoogleProvider{cfg: cfg, client: &http.Client{}}
}

func (p *GoogleProvider) Name() string { return "google" }

func (p *GoogleProvider) Score(_ context.Context, _ string, _ []SourceSummary) ([]SourceScore, Usage, error) {
	return nil, Usage{}, fmt.Errorf("not yet implemented")
}
