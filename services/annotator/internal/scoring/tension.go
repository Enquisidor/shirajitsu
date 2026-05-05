package scoring

import (
	"github.com/shirajitsu/annotator/internal/domain"
	"github.com/shirajitsu/annotator/internal/llm"
)

// evaluatedSource describes the accessible/tier shape from the request body.
// It mirrors the source fields the handler receives so DetermineState can be package-local.
type EvaluatedSource struct {
	Tier       string
	Accessible bool
}

// ComputeTensionRating computes the weighted mean divergence across all Tier 1/2 sources.
// Formula: Σ(divergenceScore × relevanceScore) / Σ(relevanceScore)
// Returns nil if no Tier 1/2 sources have a non-nil divergenceScore.
func ComputeTensionRating(scores []llm.SourceScore, sources []llm.SourceSummary) *domain.TensionRating {
	// Build a tier lookup by source index
	tierByIndex := make(map[int]string, len(sources))
	for _, s := range sources {
		tierByIndex[s.Index] = s.Tier
	}

	var weightedSum float64
	var weightSum float64
	var tier12Count int
	hasDivergence := false

	for _, sc := range scores {
		tier, ok := tierByIndex[sc.SourceIndex]
		if !ok {
			continue
		}
		if tier != "tier1" && tier != "tier2" {
			continue
		}
		tier12Count++
		if sc.DivergenceScore == nil {
			continue
		}
		hasDivergence = true
		weightedSum += *sc.DivergenceScore * sc.RelevanceScore
		weightSum += sc.RelevanceScore
	}

	if !hasDivergence {
		return nil
	}

	var score float64
	if weightSum == 0 {
		score = 0
	} else {
		score = weightedSum / weightSum
	}

	// Clamp to 0.0–1.0
	if score < 0 {
		score = 0
	}
	if score > 1 {
		score = 1
	}

	return &domain.TensionRating{
		Score:       score,
		SourceCount: tier12Count,
	}
}

// DetermineState returns the annotation state based on source accessibility.
// sourced: any Tier 1/2 source is accessible=true
// limited: at least one Tier 1/2 source exists but none are accessible
// unverified: no Tier 1/2 sources at all
func DetermineState(sources []EvaluatedSource) domain.AnnotationState {
	hasTier12 := false
	hasAccessible := false

	for _, s := range sources {
		if s.Tier == "tier1" || s.Tier == "tier2" {
			hasTier12 = true
			if s.Accessible {
				hasAccessible = true
			}
		}
	}

	if !hasTier12 {
		return domain.StateUnverified
	}
	if hasAccessible {
		return domain.StateSourced
	}
	return domain.StateLimited
}
