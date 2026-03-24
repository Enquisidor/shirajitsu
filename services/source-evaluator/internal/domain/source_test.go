package domain_test

import (
	"testing"

	"github.com/shirajitsu/source-evaluator/internal/domain"
)

func TestDetermineState(t *testing.T) {
	tests := []struct {
		name    string
		sources []domain.Source
		want    domain.AnnotationState
	}{
		{
			name: "accessible tier1 source → sourced",
			sources: []domain.Source{
				{Tier: domain.TierInstitutional, Accessible: true},
			},
			want: domain.StateSourced,
		},
		{
			name: "inaccessible tier2 only → limited",
			sources: []domain.Source{
				{Tier: domain.TierReputable, Accessible: false},
			},
			want: domain.StateLimited,
		},
		{
			name: "only tier3 sources → unverified",
			sources: []domain.Source{
				{Tier: domain.TierUnrated, Accessible: true},
			},
			want: domain.StateUnverified,
		},
		{
			name:    "no sources → unverified",
			sources: []domain.Source{},
			want:    domain.StateUnverified,
		},
		{
			name: "mix of accessible and inaccessible tier1/2 → sourced",
			sources: []domain.Source{
				{Tier: domain.TierInstitutional, Accessible: false},
				{Tier: domain.TierReputable, Accessible: true},
			},
			want: domain.StateSourced,
		},
		{
			name: "community-verified alone → unverified (does not generate rating)",
			sources: []domain.Source{
				{Tier: domain.TierCommunityVerified, Accessible: true},
			},
			want: domain.StateUnverified,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := domain.DetermineState(tt.sources)
			if got != tt.want {
				t.Errorf("DetermineState() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestTier_GeneratesRating(t *testing.T) {
	if !domain.TierInstitutional.GeneratesRating() {
		t.Error("tier1 should generate rating")
	}
	if !domain.TierReputable.GeneratesRating() {
		t.Error("tier2 should generate rating")
	}
	if domain.TierCommunityVerified.GeneratesRating() {
		t.Error("community-verified should not generate rating")
	}
	if domain.TierUnrated.GeneratesRating() {
		t.Error("tier3 should not generate rating")
	}
}
