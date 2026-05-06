package pipeline_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/shirajitsu/gateway/internal/domain"
	"github.com/shirajitsu/gateway/internal/pipeline"
)

// setupMockServers creates three httptest.Server instances that simulate the three
// downstream services. Each server's handler can be overridden per test.
type mockServers struct {
	claimExtractor  *httptest.Server
	sourceEvaluator *httptest.Server
	annotator       *httptest.Server
}

func (m *mockServers) close() {
	m.claimExtractor.Close()
	m.sourceEvaluator.Close()
	m.annotator.Close()
}

func defaultExtractHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"claims": []map[string]interface{}{
				{
					"claimText":     "The sky is blue.",
					"charOffset":    0,
					"charLength":    16,
					"riskLevel":     "low",
					"riskReasoning": "well-known fact",
					"searchQuery":   "sky color",
				},
			},
		})
	}
}

func defaultEvaluateHandler(registryVersion string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"registryVersion": registryVersion,
			"evaluatedClaims": []map[string]interface{}{
				{
					"claimIndex": 0,
					"sources": []map[string]interface{}{
						{
							"url":        "https://example.com/article",
							"title":      "Example Article",
							"tier":       "tier1",
							"tierLabel":  "Tier 1",
							"summary":    "The sky is indeed blue.",
							"accessible": true,
						},
					},
					"commentaryItems": []interface{}{},
				},
			},
		})
	}
}

func defaultAnnotateHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		divScore := 0.1
		json.NewEncoder(w).Encode(map[string]interface{}{
			"annotations": []map[string]interface{}{
				{
					"claim": map[string]interface{}{
						"claimText":     "The sky is blue.",
						"charOffset":    0,
						"charLength":    16,
						"riskLevel":     "low",
						"riskReasoning": "well-known fact",
						"searchQuery":   "sky color",
					},
					"state": "supporting",
					"tensionRating": map[string]interface{}{
						"score":       0.1,
						"sourceCount": 1,
						"label":       "low",
					},
					"sources": []map[string]interface{}{
						{
							"url":             "https://example.com/article",
							"title":           "Example Article",
							"tier":            "tier1",
							"tierLabel":       "Tier 1",
							"summary":         "The sky is indeed blue.",
							"accessible":      true,
							"relevanceScore":  0.9,
							"divergenceScore": &divScore,
						},
					},
					"commentaryItems":  []interface{}{},
					"generatedAt":      "2026-05-06T00:00:00Z",
					"evaluationFailed": false,
				},
			},
			"usage": map[string]interface{}{
				"inputTokens":  100,
				"outputTokens": 50,
			},
		})
	}
}

func newMockServers(
	extractHandler http.HandlerFunc,
	evaluateHandler http.HandlerFunc,
	annotateHandler http.HandlerFunc,
) *mockServers {
	return &mockServers{
		claimExtractor:  httptest.NewServer(extractHandler),
		sourceEvaluator: httptest.NewServer(evaluateHandler),
		annotator:       httptest.NewServer(annotateHandler),
	}
}

// TestPipeline_HappyPath verifies that a successful three-way call produces a correct AnalyzeResponse.
func TestPipeline_HappyPath(t *testing.T) {
	servers := newMockServers(
		defaultExtractHandler(),
		defaultEvaluateHandler("1.2.3"),
		defaultAnnotateHandler(),
	)
	defer servers.close()

	p := pipeline.New(
		servers.claimExtractor.URL,
		servers.sourceEvaluator.URL,
		servers.annotator.URL,
	)

	req := domain.AnalyzeRequest{
		Text:    "The sky is blue.",
		Context: domain.ContextReader,
	}

	resp, err := p.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("Run() unexpected error: %v", err)
	}

	if resp == nil {
		t.Fatal("Run() returned nil response")
	}

	// analysisId must be non-empty
	if resp.AnalysisID == "" {
		t.Error("AnalysisID must not be empty")
	}

	// registryVersion from source-evaluator
	if resp.RegistryVersion != "1.2.3" {
		t.Errorf("RegistryVersion = %q, want %q", resp.RegistryVersion, "1.2.3")
	}

	// sessionStats
	if resp.SessionStats.TotalClaims != 1 {
		t.Errorf("TotalClaims = %d, want 1", resp.SessionStats.TotalClaims)
	}
	if resp.SessionStats.SuccessfulClaims != 1 {
		t.Errorf("SuccessfulClaims = %d, want 1", resp.SessionStats.SuccessfulClaims)
	}
	if resp.SessionStats.FailedClaims != 0 {
		t.Errorf("FailedClaims = %d, want 0", resp.SessionStats.FailedClaims)
	}
	if resp.SessionStats.TotalTokens != 150 {
		t.Errorf("TotalTokens = %d, want 150", resp.SessionStats.TotalTokens)
	}
	if resp.SessionStats.TotalSources != 1 {
		t.Errorf("TotalSources = %d, want 1", resp.SessionStats.TotalSources)
	}

	// annotations
	if len(resp.Annotations) != 1 {
		t.Fatalf("len(Annotations) = %d, want 1", len(resp.Annotations))
	}
	ann := resp.Annotations[0]
	if ann.Claim.ClaimText != "The sky is blue." {
		t.Errorf("Annotation.Claim.ClaimText = %q, want %q", ann.Claim.ClaimText, "The sky is blue.")
	}
	if ann.TensionRating == nil {
		t.Error("TensionRating must not be nil")
	} else {
		if ann.TensionRating.Label != "low" {
			t.Errorf("TensionRating.Label = %q, want %q", ann.TensionRating.Label, "low")
		}
	}
	if len(ann.Sources) != 1 {
		t.Errorf("len(Sources) = %d, want 1", len(ann.Sources))
	}

	// failedClaims must be non-nil empty slice
	if resp.FailedClaims == nil {
		t.Error("FailedClaims must not be nil")
	}
	if len(resp.FailedClaims) != 0 {
		t.Errorf("len(FailedClaims) = %d, want 0", len(resp.FailedClaims))
	}
}

// TestPipeline_ClaimExtractorFailure verifies that a claim-extractor error surfaces as a pipeline error.
func TestPipeline_ClaimExtractorFailure(t *testing.T) {
	servers := newMockServers(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"extraction failed"}`))
		},
		defaultEvaluateHandler("1.0.0"),
		defaultAnnotateHandler(),
	)
	defer servers.close()

	p := pipeline.New(
		servers.claimExtractor.URL,
		servers.sourceEvaluator.URL,
		servers.annotator.URL,
	)

	req := domain.AnalyzeRequest{
		Text:    "Some text.",
		Context: domain.ContextReader,
	}

	_, err := p.Run(context.Background(), req)
	if err == nil {
		t.Fatal("expected error from claim-extractor failure, got nil")
	}
}

// TestPipeline_SourceEvaluatorFailure verifies that a source-evaluator error surfaces as a pipeline error.
func TestPipeline_SourceEvaluatorFailure(t *testing.T) {
	servers := newMockServers(
		defaultExtractHandler(),
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
			w.Write([]byte(`{"error":"search provider unavailable"}`))
		},
		defaultAnnotateHandler(),
	)
	defer servers.close()

	p := pipeline.New(
		servers.claimExtractor.URL,
		servers.sourceEvaluator.URL,
		servers.annotator.URL,
	)

	req := domain.AnalyzeRequest{
		Text:    "Some text.",
		Context: domain.ContextReader,
	}

	_, err := p.Run(context.Background(), req)
	if err == nil {
		t.Fatal("expected error from source-evaluator failure, got nil")
	}
}

// TestPipeline_AnnotatorPartialFailure verifies that claims with EvaluationFailed=true
// are collected into FailedClaims and excluded from Annotations.
func TestPipeline_AnnotatorPartialFailure(t *testing.T) {
	servers := newMockServers(
		// Two claims extracted
		func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"claims": []map[string]interface{}{
					{
						"claimText":     "Claim A",
						"charOffset":    0,
						"charLength":    7,
						"riskLevel":     "high",
						"riskReasoning": "reason A",
						"searchQuery":   "claim a",
					},
					{
						"claimText":     "Claim B",
						"charOffset":    8,
						"charLength":    7,
						"riskLevel":     "low",
						"riskReasoning": "reason B",
						"searchQuery":   "claim b",
					},
				},
			})
		},
		// Two evaluated claims
		func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"registryVersion": "1.0.0",
				"evaluatedClaims": []map[string]interface{}{
					{
						"claimIndex":      0,
						"sources":         []map[string]interface{}{},
						"commentaryItems": []interface{}{},
					},
					{
						"claimIndex":      1,
						"sources":         []map[string]interface{}{},
						"commentaryItems": []interface{}{},
					},
				},
			})
		},
		// Claim A succeeds, Claim B fails
		func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"annotations": []map[string]interface{}{
					{
						"claim": map[string]interface{}{
							"claimText":     "Claim A",
							"charOffset":    0,
							"charLength":    7,
							"riskLevel":     "high",
							"riskReasoning": "reason A",
							"searchQuery":   "claim a",
						},
						"state":            "supporting",
						"tensionRating":    nil,
						"sources":          []interface{}{},
						"commentaryItems":  []interface{}{},
						"generatedAt":      "2026-05-06T00:00:00Z",
						"evaluationFailed": false,
					},
					{
						"claim": map[string]interface{}{
							"claimText":     "Claim B",
							"charOffset":    8,
							"charLength":    7,
							"riskLevel":     "low",
							"riskReasoning": "reason B",
							"searchQuery":   "claim b",
						},
						"state":            "",
						"tensionRating":    nil,
						"sources":          []interface{}{},
						"commentaryItems":  []interface{}{},
						"generatedAt":      "2026-05-06T00:00:00Z",
						"evaluationFailed": true,
					},
				},
				"usage": map[string]interface{}{
					"inputTokens":  50,
					"outputTokens": 10,
				},
			})
		},
	)
	defer servers.close()

	p := pipeline.New(
		servers.claimExtractor.URL,
		servers.sourceEvaluator.URL,
		servers.annotator.URL,
	)

	req := domain.AnalyzeRequest{
		Text:    "Claim A. Claim B.",
		Context: domain.ContextWriter,
	}

	resp, err := p.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("Run() unexpected error: %v", err)
	}

	if resp.SessionStats.TotalClaims != 2 {
		t.Errorf("TotalClaims = %d, want 2", resp.SessionStats.TotalClaims)
	}
	if resp.SessionStats.SuccessfulClaims != 1 {
		t.Errorf("SuccessfulClaims = %d, want 1", resp.SessionStats.SuccessfulClaims)
	}
	if resp.SessionStats.FailedClaims != 1 {
		t.Errorf("FailedClaims = %d, want 1", resp.SessionStats.FailedClaims)
	}

	if len(resp.Annotations) != 1 {
		t.Errorf("len(Annotations) = %d, want 1", len(resp.Annotations))
	}
	if len(resp.FailedClaims) != 1 {
		t.Errorf("len(FailedClaims) = %d, want 1", len(resp.FailedClaims))
	}
	if len(resp.FailedClaims) > 0 && resp.FailedClaims[0].ClaimText != "Claim B" {
		t.Errorf("FailedClaims[0].ClaimText = %q, want %q", resp.FailedClaims[0].ClaimText, "Claim B")
	}
}

// TestPipeline_RegistryVersionFallback verifies that a missing registryVersion defaults to "1.0.0".
func TestPipeline_RegistryVersionFallback(t *testing.T) {
	servers := newMockServers(
		defaultExtractHandler(),
		defaultEvaluateHandler(""), // empty registryVersion
		defaultAnnotateHandler(),
	)
	defer servers.close()

	p := pipeline.New(
		servers.claimExtractor.URL,
		servers.sourceEvaluator.URL,
		servers.annotator.URL,
	)

	resp, err := p.Run(context.Background(), domain.AnalyzeRequest{
		Text:    "The sky is blue.",
		Context: domain.ContextReader,
	})
	if err != nil {
		t.Fatalf("Run() unexpected error: %v", err)
	}
	if resp.RegistryVersion != "1.0.0" {
		t.Errorf("RegistryVersion = %q, want %q", resp.RegistryVersion, "1.0.0")
	}
}
