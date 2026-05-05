package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/shirajitsu/source-evaluator/internal/handler"
	"github.com/shirajitsu/source-evaluator/internal/paywall"
	"github.com/shirajitsu/source-evaluator/internal/registry"
	"github.com/shirajitsu/source-evaluator/internal/search"
)

// mockProvider implements search.Provider for tests without making real HTTP calls.
type mockProvider struct {
	name    string
	results []search.Result
	err     error
}

func (m *mockProvider) Name() string { return m.name }
func (m *mockProvider) Search(_ context.Context, _ string, _ int) ([]search.Result, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.results, nil
}

// newTestLoader creates a temporary registry file and returns a Loader backed by it.
func newTestLoader(t *testing.T) *registry.Loader {
	t.Helper()

	registryJSON := `{
		"version": "1.0.0",
		"sources": [
			{"domain": "nature.com", "tier": "tier1"},
			{"domain": "nytimes.com", "tier": "tier2"}
		]
	}`

	f, err := os.CreateTemp(t.TempDir(), "registry-*.json")
	if err != nil {
		t.Fatalf("create temp registry: %v", err)
	}
	if _, err := f.WriteString(registryJSON); err != nil {
		t.Fatalf("write temp registry: %v", err)
	}
	f.Close()

	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	loader, err := registry.NewLoader(f.Name(), logger)
	if err != nil {
		t.Fatalf("new loader: %v", err)
	}
	return loader
}

// newTestHandler wires up a handler with the given search provider mock.
func newTestHandler(t *testing.T, provider search.Provider) http.Handler {
	t.Helper()
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	loader := newTestLoader(t)
	detector := paywall.New(logger)
	return handler.NewEvaluateHandler(loader, provider, detector, logger)
}

// postEvaluate sends a POST /evaluate request and returns the recorder.
func postEvaluate(t *testing.T, h http.Handler, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		t.Fatalf("encode request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/evaluate", &buf)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

// TestHappyPath verifies that two valid claims produce a correctly structured response.
func TestHappyPath(t *testing.T) {
	provider := &mockProvider{
		name: "google-cse",
		results: []search.Result{
			{
				URL:     "https://www.nature.com/articles/s41586-023-1234",
				Title:   "Nature study on climate",
				Snippet: "A peer-reviewed study on climate change.",
			},
			{
				URL:     "https://reddit.com/r/science/comments/abc",
				Title:   "Reddit discussion",
				Snippet: "Interesting discussion about the study.",
			},
		},
	}

	h := newTestHandler(t, provider)

	reqBody := map[string]interface{}{
		"claims": []map[string]interface{}{
			{
				"claimText":     "CO2 levels are rising",
				"charOffset":    0,
				"charLength":    21,
				"riskLevel":     "high",
				"riskReasoning": "Climate-related",
				"searchQuery":   "CO2 levels rising evidence",
			},
			{
				"claimText":     "Sea levels are stable",
				"charOffset":    22,
				"charLength":    21,
				"riskLevel":     "medium",
				"riskReasoning": "Sea level claim",
				"searchQuery":   "sea level trend data",
			},
		},
	}

	rr := postEvaluate(t, h, reqBody)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		RegistryVersion string `json:"registryVersion"`
		EvaluatedClaims []struct {
			ClaimIndex      int `json:"claimIndex"`
			Sources         []struct {
				URL        string `json:"url"`
				Tier       string `json:"tier"`
				TierLabel  string `json:"tierLabel"`
				Accessible bool   `json:"accessible"`
			} `json:"sources"`
			CommentaryItems []struct {
				Label     string `json:"label"`
				SourceURL string `json:"sourceUrl"`
			} `json:"commentaryItems"`
		} `json:"evaluatedClaims"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	// registryVersion must be populated
	if resp.RegistryVersion == "" {
		t.Error("registryVersion must not be empty")
	}

	// evaluatedClaims must have exactly 2 entries (one per input claim)
	if len(resp.EvaluatedClaims) != 2 {
		t.Fatalf("expected 2 evaluatedClaims, got %d", len(resp.EvaluatedClaims))
	}

	// Check claimIndex ordering
	for i, ec := range resp.EvaluatedClaims {
		if ec.ClaimIndex != i {
			t.Errorf("evaluatedClaims[%d].claimIndex = %d, want %d", i, ec.ClaimIndex, i)
		}
	}

	// First claim: nature.com is a source; reddit.com is commentary
	claim0 := resp.EvaluatedClaims[0]
	if len(claim0.Sources) != 1 {
		t.Errorf("claim 0: expected 1 source, got %d", len(claim0.Sources))
	}
	if len(claim0.Sources) > 0 {
		src := claim0.Sources[0]
		if src.URL != "https://www.nature.com/articles/s41586-023-1234" {
			t.Errorf("claim 0 source URL = %q, want nature.com URL", src.URL)
		}
		if src.Tier != "tier1" {
			t.Errorf("claim 0 source tier = %q, want tier1", src.Tier)
		}
		if src.TierLabel != "Institutional" {
			t.Errorf("claim 0 source tierLabel = %q, want Institutional", src.TierLabel)
		}
	}

	if len(claim0.CommentaryItems) != 1 {
		t.Errorf("claim 0: expected 1 commentary item, got %d", len(claim0.CommentaryItems))
	}
	if len(claim0.CommentaryItems) > 0 {
		ci := claim0.CommentaryItems[0]
		if ci.Label != "unverified-public-discussion" {
			t.Errorf("commentary label = %q, want unverified-public-discussion", ci.Label)
		}
		if !strings.Contains(ci.SourceURL, "reddit.com") {
			t.Errorf("commentary sourceUrl = %q, want reddit.com URL", ci.SourceURL)
		}
	}

	// Second claim: same mock results, same structure
	claim1 := resp.EvaluatedClaims[1]
	if len(claim1.Sources) != 1 {
		t.Errorf("claim 1: expected 1 source, got %d", len(claim1.Sources))
	}
}

// TestEmptyClaimsArray verifies that an empty claims array returns 400.
func TestEmptyClaimsArray(t *testing.T) {
	provider := &mockProvider{name: "google-cse", results: nil}
	h := newTestHandler(t, provider)

	reqBody := map[string]interface{}{
		"claims": []interface{}{},
	}
	rr := postEvaluate(t, h, reqBody)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}

	var errResp struct {
		Error string `json:"error"`
		Code  string `json:"code"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if errResp.Code != "invalid_request" {
		t.Errorf("error code = %q, want invalid_request", errResp.Code)
	}
}

// TestMalformedJSONBody verifies that a malformed body returns 400.
func TestMalformedJSONBody(t *testing.T) {
	provider := &mockProvider{name: "google-cse", results: nil}
	h := newTestHandler(t, provider)

	req := httptest.NewRequest(http.MethodPost, "/evaluate", strings.NewReader(`{this is not valid json`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}

	var errResp struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if errResp.Code != "invalid_request" {
		t.Errorf("error code = %q, want invalid_request", errResp.Code)
	}
}

// TestSearchProviderError verifies that a search provider failure returns 502.
func TestSearchProviderError(t *testing.T) {
	provider := &mockProvider{
		name: "google-cse",
		err:  fmt.Errorf("connection refused"),
	}
	h := newTestHandler(t, provider)

	reqBody := map[string]interface{}{
		"claims": []map[string]interface{}{
			{
				"claimText":   "Some claim",
				"charOffset":  0,
				"charLength":  10,
				"riskLevel":   "low",
				"searchQuery": "some claim query",
			},
		},
	}
	rr := postEvaluate(t, h, reqBody)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d: %s", rr.Code, rr.Body.String())
	}

	var errResp struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if errResp.Code != "upstream_error" {
		t.Errorf("error code = %q, want upstream_error", errResp.Code)
	}
}

// TestNoSearchResults verifies that a claim with no results gets empty sources and commentaryItems.
func TestNoSearchResults(t *testing.T) {
	provider := &mockProvider{
		name:    "google-cse",
		results: []search.Result{},
	}
	h := newTestHandler(t, provider)

	reqBody := map[string]interface{}{
		"claims": []map[string]interface{}{
			{
				"claimText":   "Obscure claim with no results",
				"charOffset":  0,
				"charLength":  28,
				"riskLevel":   "low",
				"searchQuery": "obscure claim no results",
			},
		},
	}
	rr := postEvaluate(t, h, reqBody)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		EvaluatedClaims []struct {
			ClaimIndex      int           `json:"claimIndex"`
			Sources         []interface{} `json:"sources"`
			CommentaryItems []interface{} `json:"commentaryItems"`
		} `json:"evaluatedClaims"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(resp.EvaluatedClaims) != 1 {
		t.Fatalf("expected 1 evaluatedClaim, got %d", len(resp.EvaluatedClaims))
	}
	ec := resp.EvaluatedClaims[0]
	if ec.Sources == nil {
		t.Error("sources must not be null (should be [])")
	}
	if ec.CommentaryItems == nil {
		t.Error("commentaryItems must not be null (should be [])")
	}
	if len(ec.Sources) != 0 {
		t.Errorf("expected 0 sources, got %d", len(ec.Sources))
	}
	if len(ec.CommentaryItems) != 0 {
		t.Errorf("expected 0 commentaryItems, got %d", len(ec.CommentaryItems))
	}
}
