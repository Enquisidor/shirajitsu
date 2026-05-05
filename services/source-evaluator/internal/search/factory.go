package search

import (
	"fmt"
	"os"
)

// ConfigFromEnv reads the search provider configuration from environment variables.
// Required env vars:
//   - SEARCH_PROVIDER: "brave" | "serpapi" | "google-cse" | "bing" | "duckduckgo"
//   - SEARCH_API_KEY:  API key for the selected provider (not required for duckduckgo)
//   - GOOGLE_CSE_ID:   Custom Search Engine ID (required when SEARCH_PROVIDER=google-cse)
func ConfigFromEnv() Config {
	return Config{
		Provider:    env("SEARCH_PROVIDER", "google-cse"),
		APIKey:      os.Getenv("SEARCH_API_KEY"),
		GoogleCSEID: os.Getenv("GOOGLE_CSE_ID"),
	}
}

// New returns the Provider implementation for the given config.
func New(cfg Config) (Provider, error) {
	switch cfg.Provider {
	case "google-cse":
		return NewGoogleCSEProvider(cfg.APIKey, cfg.GoogleCSEID), nil
	case "brave":
		return NewBraveProvider(cfg.APIKey), nil
	case "serpapi":
		return NewSerpAPIProvider(cfg.APIKey), nil
	case "bing":
		return NewBingProvider(cfg.APIKey), nil
	case "duckduckgo":
		return NewDuckDuckGoProvider(), nil
	default:
		return nil, fmt.Errorf("unknown search provider %q — supported: brave, serpapi, google-cse, bing, duckduckgo", cfg.Provider)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
