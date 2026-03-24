package registry

import (
	"net/url"
	"strings"

	"github.com/shirajitsu/source-evaluator/internal/domain"
)

// ClassifyURL returns the tier for a given source URL based on the registry rules.
// This mirrors the logic in registry/source-registry.json and must be kept in sync.
func ClassifyURL(rawURL string) domain.Tier {
	u, err := url.Parse(rawURL)
	if err != nil {
		return domain.TierUnrated
	}
	host := strings.TrimPrefix(u.Hostname(), "www.")

	if isTier1(host, u.Path) {
		return domain.TierInstitutional
	}
	if host == "wikipedia.org" || strings.HasSuffix(host, ".wikipedia.org") {
		return domain.TierCommunityVerified
	}
	if isTier2(host) {
		return domain.TierReputable
	}
	return domain.TierUnrated
}

func isTier1(host, path string) bool {
	tier1Domains := []string{
		"pubmed.ncbi.nlm.nih.gov", "nih.gov", "cdc.gov", "who.int",
		"cochrane.org", "nature.com", "science.org", "nejm.org",
		"thelancet.com", "bmj.com", "jstor.org", "arxiv.org",
		"ncbi.nlm.nih.gov", "pnas.org", "cell.com",
	}
	for _, d := range tier1Domains {
		if host == d || strings.HasSuffix(host, "."+d) {
			return true
		}
	}
	// Pattern-based: .edu and .gov domains
	return strings.HasSuffix(host, ".edu") || strings.HasSuffix(host, ".gov")
}

func isTier2(host string) bool {
	tier2Domains := []string{
		"nytimes.com", "washingtonpost.com", "theguardian.com",
		"bbc.com", "bbc.co.uk", "reuters.com", "apnews.com",
		"economist.com", "ft.com", "wsj.com", "npr.org", "pbs.org",
		"politico.com", "theatlantic.com", "scientificamerican.com",
		"newscientist.com", "wired.com", "propublica.org",
		"thetimes.co.uk", "time.com",
	}
	for _, d := range tier2Domains {
		if host == d || strings.HasSuffix(host, "."+d) {
			return true
		}
	}
	return false
}
