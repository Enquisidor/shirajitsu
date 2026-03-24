package domain

// Tier represents the reliability tier of a source in the Shirajitsu registry.
type Tier string

const (
	TierInstitutional     Tier = "tier1"
	TierReputable         Tier = "tier2"
	TierCommunityVerified Tier = "community-verified"
	TierUnrated           Tier = "tier3"
)

// TierLabels maps tiers to human-readable labels shown in the UI.
var TierLabels = map[Tier]string{
	TierInstitutional:     "Institutional",
	TierReputable:         "Reputable",
	TierCommunityVerified: "Community-edited source",
	TierUnrated:           "Unrated",
}

// Source is an evaluated web source for a given claim.
type Source struct {
	URL        string
	Title      string
	Tier       Tier
	Summary    string
	Accessible bool
}

// GeneratesRating returns true if this tier contributes to a tension rating.
func (t Tier) GeneratesRating() bool {
	return t == TierInstitutional || t == TierReputable
}

// AnnotationState describes the confidence level of an annotation given available sources.
type AnnotationState string

const (
	StateSourced    AnnotationState = "sourced"
	StateLimited    AnnotationState = "limited"
	StateUnverified AnnotationState = "unverified"
)

// DetermineState returns the annotation state given a set of evaluated sources.
func DetermineState(sources []Source) AnnotationState {
	hasAccessible := false
	hasInaccessible := false

	for _, s := range sources {
		if !s.Tier.GeneratesRating() {
			continue
		}
		if s.Accessible {
			hasAccessible = true
		} else {
			hasInaccessible = true
		}
	}

	if hasAccessible {
		return StateSourced
	}
	if hasInaccessible {
		return StateLimited
	}
	return StateUnverified
}
