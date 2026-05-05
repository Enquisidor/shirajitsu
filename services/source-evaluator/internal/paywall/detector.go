package paywall

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// staticPaywallDomains is the authoritative list of known paywalled domains.
// Updated via manual PR; the weekly background job re-checks and may propose additions.
// Source: spec decision #5 — static list + live HEAD check fallback.
var staticPaywallDomains = map[string]bool{
	"nytimes.com":         true,
	"wsj.com":             true,
	"ft.com":              true,
	"economist.com":       true,
	"thetimes.co.uk":      true,
	"bloomberg.com":       true,
	"washingtonpost.com":  true,
	"newyorker.com":       true,
	"theatlantic.com":     true,
	"wired.com":           true,
	"newscientist.com":    true,
}

// Detector determines whether a domain is paywalled.
// It checks a static list first; if absent, issues a live HTTP HEAD request
// and caches the result. A weekly background job re-checks all cached domains.
type Detector struct {
	mu         sync.RWMutex
	cache      map[string]bool // domain → isPaywalled
	httpClient *http.Client
	logger     *slog.Logger
}

// New constructs a Detector with a 5-second HEAD request timeout.
func New(logger *slog.Logger) *Detector {
	return &Detector{
		cache:  make(map[string]bool),
		logger: logger,
		httpClient: &http.Client{
			Timeout:       5 * time.Second,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
		},
	}
}

// IsAccessible returns true if the URL is likely accessible (not paywalled).
// Logic (spec decision #5):
//  1. Domain is on the static paywall list → false
//  2. Domain is cached from a prior HEAD check → cached result
//  3. Otherwise → live HEAD check → cache and return result
func (d *Detector) IsAccessible(ctx context.Context, rawURL string) bool {
	domain := extractDomain(rawURL)
	if domain == "" {
		return true // unparseable URL — optimistic
	}

	// Step 1: static list
	if staticPaywallDomains[domain] {
		return false
	}

	// Step 2: cache
	d.mu.RLock()
	if cached, ok := d.cache[domain]; ok {
		d.mu.RUnlock()
		return !cached
	}
	d.mu.RUnlock()

	// Step 3: live HEAD check
	isPaywalled := d.headCheck(ctx, rawURL)

	d.mu.Lock()
	d.cache[domain] = isPaywalled
	d.mu.Unlock()

	return !isPaywalled
}

// headCheck issues an HTTP HEAD to rawURL and returns true if it appears paywalled.
// Heuristic: a 401, 402, 403, or a redirect to a login/subscribe path signals a paywall.
func (d *Detector) headCheck(ctx context.Context, rawURL string) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, rawURL, nil)
	if err != nil {
		d.logger.Warn("paywall HEAD: could not build request", "url", rawURL, "err", err)
		return false // assume accessible on error
	}
	req.Header.Set("User-Agent", "Shirajitsu-Bot/1.0 (source accessibility check)")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		d.logger.Warn("paywall HEAD: request failed", "url", rawURL, "err", err)
		return false // assume accessible on error
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusUnauthorized, http.StatusPaymentRequired, http.StatusForbidden:
		return true
	case http.StatusFound, http.StatusMovedPermanently, http.StatusSeeOther:
		location := resp.Header.Get("Location")
		return isPaywallRedirect(location)
	}
	return false
}

// StartWeeklyRechecker launches a background goroutine that re-checks all cached
// domains every 7 days and refreshes their paywall status.
// The goroutine stops when ctx is cancelled.
func (d *Detector) StartWeeklyRechecker(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(7 * 24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				d.recheckAll(ctx)
			}
		}
	}()
}

// recheckAll iterates over all cached domains and refreshes their paywall status.
// It constructs a minimal HTTPS URL for the HEAD check. It is idempotent.
func (d *Detector) recheckAll(ctx context.Context) {
	d.mu.RLock()
	domains := make([]string, 0, len(d.cache))
	for domain := range d.cache {
		domains = append(domains, domain)
	}
	d.mu.RUnlock()

	d.logger.Info("paywall weekly recheck starting", "domain_count", len(domains))
	for _, domain := range domains {
		syntheticURL := "https://" + domain + "/"
		isPaywalled := d.headCheck(ctx, syntheticURL)
		d.mu.Lock()
		d.cache[domain] = isPaywalled
		d.mu.Unlock()
		d.logger.Info("paywall recheck", "domain", domain, "paywalled", isPaywalled)
	}
	d.logger.Info("paywall weekly recheck complete", "domain_count", len(domains))
}

// extractDomain strips the scheme, port, and www. prefix from a URL to get the base domain.
func extractDomain(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	host := u.Hostname()
	return strings.TrimPrefix(host, "www.")
}

// isPaywallRedirect returns true if a redirect Location header indicates a paywall.
func isPaywallRedirect(location string) bool {
	loc := strings.ToLower(location)
	for _, pattern := range []string{"login", "subscribe", "subscription", "register", "paywall", "account/signin"} {
		if strings.Contains(loc, pattern) {
			return true
		}
	}
	return false
}
