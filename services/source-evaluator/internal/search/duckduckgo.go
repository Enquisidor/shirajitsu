package search

import (
	"context"
	"fmt"
)

// DuckDuckGoProvider is a stub implementing the DuckDuckGo search provider.
// DuckDuckGo does not offer a public programmatic API; this stub exists to
// satisfy the interface for configuration completeness.
type DuckDuckGoProvider struct{}

// NewDuckDuckGoProvider constructs a DuckDuckGoProvider stub.
func NewDuckDuckGoProvider() *DuckDuckGoProvider {
	return &DuckDuckGoProvider{}
}

func (p *DuckDuckGoProvider) Name() string { return "duckduckgo" }

// Search is a stub — returns an error until/unless a DuckDuckGo adapter is built.
func (p *DuckDuckGoProvider) Search(_ context.Context, query string, _ int) ([]Result, error) {
	return nil, fmt.Errorf("duckduckgo search provider not yet implemented (query: %q)", query)
}
