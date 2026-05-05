package search

import (
	"context"
	"fmt"
)

// BraveProvider is a stub implementing the Brave Search API.
// Replace this stub with a real implementation when a Brave API key is available.
type BraveProvider struct {
	apiKey string
	client interface{} // placeholder — use *http.Client in real implementation
}

// NewBraveProvider constructs a BraveProvider stub.
func NewBraveProvider(apiKey string) *BraveProvider {
	return &BraveProvider{apiKey: apiKey}
}

func (p *BraveProvider) Name() string { return "brave" }

// Search is a stub — returns ErrNotImplemented until the Brave adapter is built.
func (p *BraveProvider) Search(_ context.Context, query string, _ int) ([]Result, error) {
	return nil, fmt.Errorf("brave search provider not yet implemented (query: %q)", query)
}
