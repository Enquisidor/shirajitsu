package domain_test

import (
	"testing"

	"github.com/shirajitsu/gateway/internal/domain"
)

func TestAnalyzeRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     domain.AnalyzeRequest
		wantErr bool
	}{
		{
			name:    "valid reader request",
			req:     domain.AnalyzeRequest{Text: "some text", Context: domain.ContextReader},
			wantErr: false,
		},
		{
			name:    "valid writer request",
			req:     domain.AnalyzeRequest{Text: "draft text", Context: domain.ContextWriter},
			wantErr: false,
		},
		{
			name:    "empty text",
			req:     domain.AnalyzeRequest{Text: "", Context: domain.ContextReader},
			wantErr: true,
		},
		{
			name:    "invalid context",
			req:     domain.AnalyzeRequest{Text: "text", Context: "unknown"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
