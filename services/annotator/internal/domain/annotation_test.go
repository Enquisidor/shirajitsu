package domain_test

import (
	"strings"
	"testing"

	"github.com/shirajitsu/annotator/internal/domain"
)

func TestTensionRating_Label(t *testing.T) {
	tests := []struct {
		name        string
		rating      domain.TensionRating
		wantContain string
	}{
		{
			name:        "no sources",
			rating:      domain.TensionRating{Score: 0, SourceCount: 0},
			wantContain: "No rated sources",
		},
		{
			name:        "low divergence",
			rating:      domain.TensionRating{Score: 0.1, SourceCount: 5},
			wantContain: "largely frame this consistently",
		},
		{
			name:        "some variation",
			rating:      domain.TensionRating{Score: 0.35, SourceCount: 4},
			wantContain: "some variation in framing",
		},
		{
			name:        "notable differences",
			rating:      domain.TensionRating{Score: 0.6, SourceCount: 3},
			wantContain: "notable framing differences",
		},
		{
			name:        "substantial differences",
			rating:      domain.TensionRating{Score: 0.85, SourceCount: 6},
			wantContain: "substantial framing differences",
		},
		{
			name:        "source count shown in label",
			rating:      domain.TensionRating{Score: 0.5, SourceCount: 7},
			wantContain: "7 sources",
		},
	}

	forbidden := []string{"contradiction", "false", "incorrect", "wrong", "misleading", "verdict"}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			label := tt.rating.Label()
			if !strings.Contains(label, tt.wantContain) {
				t.Errorf("Label() = %q, want it to contain %q", label, tt.wantContain)
			}
			for _, word := range forbidden {
				if strings.Contains(strings.ToLower(label), word) {
					t.Errorf("Label() contains forbidden word %q: %q", word, label)
				}
			}
		})
	}
}
