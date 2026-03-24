package llm

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/shirajitsu/claim-extractor/internal/domain"
)

// parseClaims handles JSON returned by any provider.
// Models sometimes wrap arrays in an object — we handle both shapes.
func parseClaims(raw string) ([]domain.Claim, error) {
	raw = strings.TrimSpace(raw)

	// Try direct array first
	var claims []domain.Claim
	if err := json.Unmarshal([]byte(raw), &claims); err == nil {
		return claims, nil
	}

	// Try wrapped: {"claims": [...]}
	var wrapped struct {
		Claims []domain.Claim `json:"claims"`
	}
	if err := json.Unmarshal([]byte(raw), &wrapped); err == nil {
		return wrapped.Claims, nil
	}

	return nil, fmt.Errorf("could not parse claims from LLM response: %s", raw[:min(len(raw), 200)])
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
