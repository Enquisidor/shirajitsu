package commentary

import (
	"net/url"
	"strings"
)

// commentaryDomains is the authoritative set of domains classified as commentary
// (unverified public discussion). Derived from spec api-contracts.md section 3 and
// resolved open item #2 in api-contracts.md.
// Borderline cases (Medium, Substack, personal blogs) default to tier3, not commentary.
var commentaryDomains = map[string]bool{
	"reddit.com":           true,
	"twitter.com":          true,
	"x.com":                true,
	"facebook.com":         true,
	"threads.net":          true,
	"instagram.com":        true,
	"tiktok.com":           true,
	"quora.com":            true,
	"news.ycombinator.com": true,
	"linkedin.com":         true,
	"tumblr.com":           true,
	"pinterest.com":        true,
	"youtube.com":          true,
}

// IsCommentary returns true if the URL's domain is a known social/forum platform
// and should be classified as an unverified-public-discussion item rather than a source.
func IsCommentary(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	host := strings.TrimPrefix(u.Hostname(), "www.")
	// Check exact domain and subdomains (e.g. old.reddit.com)
	for domain := range commentaryDomains {
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return true
		}
	}
	return false
}
