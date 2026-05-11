package handlers_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/shirajitsu/gateway/internal/domain"
	"github.com/shirajitsu/gateway/internal/handlers"
	"github.com/shirajitsu/gateway/internal/pipeline"
)

var testLogger = slog.New(slog.NewJSONHandler(os.Stderr, nil))

// buildPipelineWithMocks creates a real Pipeline backed by three mock http servers.
func buildPipelineWithMocks(
	extractFn http.HandlerFunc,
	evaluateFn http.HandlerFunc,
	annotateFn http.HandlerFunc,
) (*pipeline.Pipeline, func()) {
	extractSrv := httptest.NewServer(extractFn)
	evaluateSrv := httptest.NewServer(evaluateFn)
	annotateSrv := httptest.NewServer(annotateFn)

	p := pipeline.New(extractSrv.URL, evaluateSrv.URL, annotateSrv.URL)
	cleanup := func() {
		extractSrv.Close()
		evaluateSrv.Close()
		annotateSrv.Close()
	}
	return p, cleanup
}

// successExtractFn returns one claim.
func successExtractFn(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"claims": []map[string]interface{}{
			{
				"claimText":     "Vaccines cause autism.",
				"charOffset":    0,
				"charLength":    22,
				"riskLevel":     "high",
				"riskReasoning": "disputed medical claim",
				"searchQuery":   "vaccines autism",
			},
		},
	})
}

// successEvaluateFn returns one evaluated claim.
func successEvaluateFn(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"registryVersion": "2.0.0",
		"evaluatedClaims": []map[string]interface{}{
			{
				"claimIndex": 0,
				"sources": []map[string]interface{}{
					{
						"url":        "https://cdc.gov/vaccines",
						"title":      "CDC Vaccine Safety",
						"tier":       "tier1",
						"tierLabel":  "Tier 1",
						"summary":    "Vaccines do not cause autism.",
						"accessible": true,
					},
				},
				"commentaryItems": []interface{}{},
			},
		},
	})
}

// successAnnotateFn returns one successful annotation.
func successAnnotateFn(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"annotations": []map[string]interface{}{
			{
				"claim": map[string]interface{}{
					"claimText":     "Vaccines cause autism.",
					"charOffset":    0,
					"charLength":    22,
					"riskLevel":     "high",
					"riskReasoning": "disputed medical claim",
					"searchQuery":   "vaccines autism",
				},
				"state": "opposing",
				"tensionRating": map[string]interface{}{
					"score":       0.9,
					"sourceCount": 1,
					"label":       "high",
				},
				"sources":          []interface{}{},
				"commentaryItems":  []interface{}{},
				"generatedAt":      "2026-05-06T00:00:00Z",
				"evaluationFailed": false,
			},
		},
		"usage": map[string]interface{}{
			"inputTokens":  200,
			"outputTokens": 80,
		},
	})
}

// TestAnalyze_MissingText verifies that a missing text field returns 400.
func TestAnalyze_MissingText(t *testing.T) {
	p, cleanup := buildPipelineWithMocks(successExtractFn, successEvaluateFn, successAnnotateFn)
	defer cleanup()

	handler := handlers.Analyze(testLogger, p)

	req := httptest.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader(`{"context":"reader"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	var respBody map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&respBody); err != nil {
		t.Fatalf("could not decode response body: %v", err)
	}
	if respBody["error"] == "" {
		t.Error("expected 'error' field in response body")
	}
}

// TestAnalyze_InvalidBody verifies that a malformed JSON body returns 400.
func TestAnalyze_InvalidBody(t *testing.T) {
	p, cleanup := buildPipelineWithMocks(successExtractFn, successEvaluateFn, successAnnotateFn)
	defer cleanup()

	handler := handlers.Analyze(testLogger, p)

	req := httptest.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

// TestAnalyze_PipelineSuccess verifies that a successful pipeline run returns 200 with a correct shape.
func TestAnalyze_PipelineSuccess(t *testing.T) {
	p, cleanup := buildPipelineWithMocks(successExtractFn, successEvaluateFn, successAnnotateFn)
	defer cleanup()

	handler := handlers.Analyze(testLogger, p)

	body, _ := json.Marshal(map[string]string{
		"text":    "Vaccines cause autism.",
		"context": "reader",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var resp domain.AnalyzeResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("could not decode response body: %v", err)
	}

	if resp.AnalysisID == "" {
		t.Error("AnalysisID must not be empty")
	}
	if resp.RegistryVersion != "2.0.0" {
		t.Errorf("RegistryVersion = %q, want %q", resp.RegistryVersion, "2.0.0")
	}
	if resp.SessionStats.TotalClaims != 1 {
		t.Errorf("TotalClaims = %d, want 1", resp.SessionStats.TotalClaims)
	}
	if resp.SessionStats.TotalTokens != 280 {
		t.Errorf("TotalTokens = %d, want 280 (200 input + 80 output)", resp.SessionStats.TotalTokens)
	}
	if len(resp.Annotations) != 1 {
		t.Fatalf("len(Annotations) = %d, want 1", len(resp.Annotations))
	}
	if resp.Annotations[0].Claim.ClaimText != "Vaccines cause autism." {
		t.Errorf("Annotation claim text = %q, want %q", resp.Annotations[0].Claim.ClaimText, "Vaccines cause autism.")
	}
}

// TestAnalyze_PipelineError verifies that a pipeline error returns 502 with the correct shape.
func TestAnalyze_PipelineError(t *testing.T) {
	p, cleanup := buildPipelineWithMocks(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusServiceUnavailable)
		},
		successEvaluateFn,
		successAnnotateFn,
	)
	defer cleanup()

	handler := handlers.Analyze(testLogger, p)

	body, _ := json.Marshal(map[string]string{
		"text":    "Some claim.",
		"context": "reader",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadGateway)
	}

	var respBody map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&respBody); err != nil {
		t.Fatalf("could not decode response body: %v", err)
	}
	if respBody["error"] != "pipeline error" {
		t.Errorf("error field = %q, want %q", respBody["error"], "pipeline error")
	}
	if respBody["detail"] == "" {
		t.Error("expected non-empty 'detail' field in error response")
	}
}

// TestAnalyze_InvalidContext verifies that an invalid context value returns 422.
func TestAnalyze_InvalidContext(t *testing.T) {
	p, cleanup := buildPipelineWithMocks(successExtractFn, successEvaluateFn, successAnnotateFn)
	defer cleanup()

	handler := handlers.Analyze(testLogger, p)

	body, _ := json.Marshal(map[string]string{
		"text":    "Some claim.",
		"context": "unknown",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnprocessableEntity)
	}
}
