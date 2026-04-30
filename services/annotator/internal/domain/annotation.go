package domain

import "fmt"

// TensionRating is a probabilistic assessment — never a verdict.
// Score is the weighted mean of (divergenceScore × relevanceScore) across all
// Tier 1/2 sources, normalised to 0.0–1.0. Maps to a blue→red gradient in the UI.
type TensionRating struct {
	// Score is 0.0 (sources align) to 1.0 (sources diverge substantially).
	Score float64
	// SourceCount is the number of Tier 1/2 sources the score is based on.
	SourceCount int
}

// Label returns an accessibility label describing the score range without a verdict.
// Language is always hedged and probabilistic — never "contradicts" or "false".
func (t TensionRating) Label() string {
	switch {
	case t.SourceCount == 0:
		return "No rated sources found"
	case t.Score < 0.25:
		return fmt.Sprintf("Sources largely frame this consistently (based on %d sources)", t.SourceCount)
	case t.Score < 0.50:
		return fmt.Sprintf("Sources show some variation in framing (based on %d sources)", t.SourceCount)
	case t.Score < 0.75:
		return fmt.Sprintf("Sources show notable framing differences (based on %d sources)", t.SourceCount)
	default:
		return fmt.Sprintf("Sources show substantial framing differences (based on %d sources)", t.SourceCount)
	}
}

// AnnotationState describes what Shirajitsu found for a given claim.
type AnnotationState string

const (
	StateSourced    AnnotationState = "sourced"
	StateLimited    AnnotationState = "limited"
	StateUnverified AnnotationState = "unverified"
)
