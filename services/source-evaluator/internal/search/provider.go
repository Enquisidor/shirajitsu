package search

import "context"

// Result is a single result returned from a search API call.
type Result struct {
	URL     string
	Title   string
	Snippet string
}

// Provider is the interface any search backend must satisfy.
// Each implementation fans out one call per claim's SearchQuery.
type Provider interface {
	// Search executes a web search for the given query and returns up to maxResults results.
	Search(ctx context.Context, query string, maxResults int) ([]Result, error)
	// Name returns a short identifier for the provider (e.g. "google-cse", "brave").
	Name() string
}

// Config holds provider selection and credentials, read from environment.
type Config struct {
	// Provider name: "brave" | "serpapi" | "google-cse" | "bing" | "duckduckgo"
	Provider string
	// APIKey is the key for the configured provider.
	APIKey string
	// GoogleCSEID is the Custom Search Engine ID, used only for provider "google-cse".
	GoogleCSEID string
}
