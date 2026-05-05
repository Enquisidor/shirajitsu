package llm

import (
	"context"
	"fmt"
	"os"
)

// SourceSummary is input to the LLM — one per source returned by source-evaluator.
type SourceSummary struct {
	Index   int
	URL     string
	Title   string
	Snippet string // raw search snippet — the "summary" field from source-evaluator
	Tier    string // "tier1" | "tier2" | "community-verified" | "tier3"
}

// SourceScore is the LLM's output for one source.
type SourceScore struct {
	SourceIndex     int
	RelevanceScore  float64
	DivergenceScore *float64 // null for community-verified and tier3
}

// Usage captures token consumption for billing/display.
type Usage struct {
	InputTokens  int
	OutputTokens int
}

// Provider is the interface any LLM backend must satisfy.
type Provider interface {
	// Score calls the LLM with the claim text and its sources and returns
	// per-source scores. One LLM call per claim.
	Score(ctx context.Context, claimText string, sources []SourceSummary) ([]SourceScore, Usage, error)
	// Name returns a short identifier ("anthropic", "openai", etc.)
	Name() string
}

// Config holds the provider selection and model identifier, read from environment.
type Config struct {
	// Provider name: "anthropic" | "openai" | "google" | "ollama"
	Provider string
	// Model identifier passed to the provider API, e.g. "claude-sonnet-4-20250514"
	Model string
	// API key for the selected provider
	APIKey string
	// Base URL override — useful for self-hosted / proxy setups
	BaseURL string
}

func ConfigFromEnv() Config {
	return Config{
		Provider: env("AI_PROVIDER", "anthropic"),
		Model:    env("AI_MODEL", "claude-sonnet-4-20250514"),
		APIKey:   os.Getenv("AI_API_KEY"),
		BaseURL:  os.Getenv("AI_BASE_URL"), // empty = use provider default
	}
}

// New returns the Provider implementation for the given config.
func New(cfg Config) (Provider, error) {
	switch cfg.Provider {
	case "anthropic":
		return NewAnthropicProvider(cfg), nil
	case "openai":
		return NewOpenAIProvider(cfg), nil
	case "google":
		return NewGoogleProvider(cfg), nil
	case "ollama":
		return NewOllamaProvider(cfg), nil
	default:
		return nil, fmt.Errorf("unknown AI provider %q — supported: anthropic, openai, google, ollama", cfg.Provider)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
