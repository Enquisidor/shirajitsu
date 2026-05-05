package search

import (
	"context"
	"fmt"
)

// BingProvider is a stub implementing the Bing Search API.
// Replace this stub with a real implementation when a Bing API key is available.
type BingProvider struct {
	apiKey string
}

// NewBingProvider constructs a BingProvider stub.
func NewBingProvider(apiKey string) *BingProvider {
	return &BingProvider{apiKey: apiKey}
}

func (p *BingProvider) Name() string { return "bing" }

// Search is a stub — returns an error until the Bing adapter is built.
func (p *BingProvider) Search(_ context.Context, query string, _ int) ([]Result, error) {
	return nil, fmt.Errorf("bing search provider not yet implemented (query: %q)", query)
}
