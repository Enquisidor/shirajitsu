package llm_test

import (
	"testing"

	"github.com/shirajitsu/claim-extractor/internal/llm"
)

func TestNew_KnownProviders(t *testing.T) {
	providers := []string{"anthropic", "openai", "google", "ollama"}
	for _, name := range providers {
		t.Run(name, func(t *testing.T) {
			p, err := llm.New(llm.Config{Provider: name, Model: "test-model"})
			if err != nil {
				t.Errorf("New(%q) returned unexpected error: %v", name, err)
			}
			if p == nil {
				t.Errorf("New(%q) returned nil provider", name)
			}
		})
	}
}

func TestNew_UnknownProvider(t *testing.T) {
	_, err := llm.New(llm.Config{Provider: "unknown-ai"})
	if err == nil {
		t.Error("expected error for unknown provider, got nil")
	}
}

func TestParseClaims_DirectArray(t *testing.T) {
	raw := `[{"claimText":"The sky is blue","charOffset":0,"charLength":14,"riskLevel":"low","riskReasoning":"Well established","searchQuery":"sky color blue"}]`
	// parseClaims is internal — tested indirectly via provider integration tests
	// This test documents the expected JSON shape
	_ = raw
}
