package llm

import (
	"context"
	"fmt"
	"os"

	"github.com/shirajitsu/claim-extractor/internal/domain"
)

// Provider is the interface any LLM backend must satisfy.
// Adding a new model = implement this interface and register it below.
type Provider interface {
	Extract(ctx context.Context, text string) ([]domain.Claim, error)
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
