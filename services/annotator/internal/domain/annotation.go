package domain

import "fmt"

// TensionRating is a probabilistic assessment — never a verdict.
// Language must always be hedged: "X of Y sources frame this differently."
type TensionRating struct {
	Numerator   int
	Denominator int
}

// Label returns the human-readable tension label.
// Uses hedged, probabilistic language — never "contradiction" or "false".
func (t TensionRating) Label() string {
	switch {
	case t.Denominator == 0:
		return "No rated sources found"
	case t.Numerator == 0:
		return fmt.Sprintf("0 of %d sources frame this differently", t.Denominator)
	default:
		return fmt.Sprintf("%d of %d sources frame this differently", t.Numerator, t.Denominator)
	}
}

// AnnotationState describes what Shirajitsu found for a given claim.
type AnnotationState string

const (
	StateSourced    AnnotationState = "sourced"
	StateLimited    AnnotationState = "limited"
	StateUnverified AnnotationState = "unverified"
)
