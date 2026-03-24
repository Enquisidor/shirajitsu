package registry_test

import (
	"testing"

	"github.com/shirajitsu/source-evaluator/internal/domain"
	"github.com/shirajitsu/source-evaluator/internal/registry"
)

func TestClassifyURL(t *testing.T) {
	tests := []struct {
		url  string
		want domain.Tier
	}{
		{"https://pubmed.ncbi.nlm.nih.gov/12345", domain.TierInstitutional},
		{"https://www.nature.com/articles/foo", domain.TierInstitutional},
		{"https://www.cdc.gov/topic/page", domain.TierInstitutional},
		{"https://harvard.edu/research/study", domain.TierInstitutional},
		{"https://en.wikipedia.org/wiki/Article", domain.TierCommunityVerified},
		{"https://www.nytimes.com/article", domain.TierReputable},
		{"https://www.bbc.co.uk/news/story", domain.TierReputable},
		{"https://reuters.com/story", domain.TierReputable},
		{"https://reddit.com/r/science/post", domain.TierUnrated},
		{"https://twitter.com/user/status/123", domain.TierUnrated},
		{"https://randomblог.com/post", domain.TierUnrated},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			got := registry.ClassifyURL(tt.url)
			if got != tt.want {
				t.Errorf("ClassifyURL(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}
