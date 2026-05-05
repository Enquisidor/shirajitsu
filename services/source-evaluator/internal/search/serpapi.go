package search

import (
	"context"
	"fmt"
)

// SerpAPIProvider is a stub implementing the SerpAPI search provider.
// Replace this stub with a real implementation when a SerpAPI key is available.
type SerpAPIProvider struct {
	apiKey string
}

// NewSerpAPIProvider constructs a SerpAPIProvider stub.
func NewSerpAPIProvider(apiKey string) *SerpAPIProvider {
	return &SerpAPIProvider{apiKey: apiKey}
}

func (p *SerpAPIProvider) Name() string { return "serpapi" }

// Search is a stub — returns ErrNotImplemented until the SerpAPI adapter is built.
func (p *SerpAPIProvider) Search(_ context.Context, query string, _ int) ([]Result, error) {
	return nil, fmt.Errorf("serpapi search provider not yet implemented (query: %q)", query)
}
