package domain_test

import (
	"strings"
	"testing"

	"github.com/shirajitsu/annotator/internal/domain"
)

func TestTensionRating_Label(t *testing.T) {
	tests := []struct {
		rating      domain.TensionRating
		wantContain string
		wantAvoid   []string
	}{
		{
			rating:      domain.TensionRating{Numerator: 4, Denominator: 5},
			wantContain: "4 of 5 sources frame this differently",
		},
		{
			rating:      domain.TensionRating{Numerator: 0, Denominator: 3},
			wantContain: "0 of 3",
		},
		{
			rating:      domain.TensionRating{Numerator: 0, Denominator: 0},
			wantContain: "No rated sources",
		},
	}

	forbidden := []string{"contradiction", "false", "incorrect", "wrong", "misleading"}

	for _, tt := range tests {
		t.Run(tt.wantContain, func(t *testing.T) {
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
