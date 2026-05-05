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
	"testing"

	"github.com/shirajitsu/annotator/internal/handler"
	"github.com/shirajitsu/annotator/internal/llm"
)

// --- Mock provider ---

type mockProvider struct {
	scores []llm.SourceScore
	usage  llm.Usage
	err    error
}

func (m *mockProvider) Score(_ context.Context, _ string, _ []llm.SourceSummary) ([]llm.SourceScore, llm.Usage, error) {
	if m.err != nil {
		return nil, llm.Usage{}, m.err
	}
	return m.scores, m.usage, nil
}

func (m *mockProvider) Name() string { return "mock" }

// --- Helpers ---

func newHandler(p llm.Provider) http.Handler {
	return &handler.AnnotateHandler{
		Provider: p,
		Logger:   slog.New(slog.NewJSONHandler(os.Stderr, nil)),
	}
}

func post(h http.Handler, body any) *httptest.ResponseRecorder {
	payload, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/annotate", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

// --- Tests ---

func TestAnnotate_HappyPath(t *testing.T) {
	div72 := 0.72
	provider := &mockProvider{
		scores: []llm.SourceScore{
			{SourceIndex: 0, RelevanceScore: 0.87, DivergenceScore: &div72},
			{SourceIndex: 1, RelevanceScore: 0.45, DivergenceScore: nil},
		},
		usage: llm.Usage{InputTokens: 100, OutputTokens: 50},
	}

	reqBody := map[string]any{
		"analysisId": "test-analysis-1",
		"claims": []map[string]any{
			{
				"claimText":     "The unemployment rate fell to 3.4%",
				"charOffset":    0,
				"charLength":    34,
				"riskLevel":     "high",
				"riskReasoning": "Economic statistics vary by source",
				"searchQuery":   "unemployment rate 3.4% 2024",
			},
		},
		"evaluatedClaims": []map[string]any{
			{
				"sources": []map[string]any{
					{
						"url":        "https://bls.gov/report",
						"title":      "BLS Employment Report",
						"tier":       "tier1",
						"tierLabel":  "Tier 1 — Government",
						"summary":    "The unemployment rate declined to 3.4 percent in January.",
						"accessible": true,
					},
					{
						"url":        "https://reddit.com/r/economics/post",
						"title":      "Reddit Economics Discussion",
						"tier":       "tier3",
						"tierLabel":  "Tier 3 — Community",
						"summary":    "Great news on jobs!",
						"accessible": true,
					},
				},
				"commentaryItems": []any{"Some commentary"},
			},
		},
	}

	rr := post(newHandler(provider), reqBody)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	annotations, ok := resp["annotations"].([]any)
	if !ok || len(annotations) != 1 {
		t.Fatalf("expected 1 annotation, got: %v", resp["annotations"])
	}

	ann := annotations[0].(map[string]any)

	// Check tension rating exists (tier1 source has divergenceScore)
	tr := ann["tensionRating"]
	if tr == nil {
		t.Fatal("expected tensionRating, got nil")
	}
	trMap := tr.(map[string]any)
	score := trMap["score"].(float64)
	if score < 0 || score > 1 {
		t.Errorf("tensionRating.score out of range: %v", score)
	}
	label, _ := trMap["label"].(string)
	if label == "" {
		t.Error("expected non-empty tensionRating.label")
	}

	// Check sources are sorted descending by relevance
	sources := ann["sources"].([]any)
	if len(sources) != 2 {
		t.Fatalf("expected 2 sources, got %d", len(sources))
	}
	first := sources[0].(map[string]any)
	second := sources[1].(map[string]any)
	firstRel := first["relevanceScore"].(float64)
	secondRel := second["relevanceScore"].(float64)
	if firstRel < secondRel {
		t.Errorf("sources not sorted descending: first=%v second=%v", firstRel, secondRel)
	}

	// The tier3 source should have null divergenceScore
	// After sorting by relevance, tier1 (0.87) is first, tier3 (0.45) is second
	firstDiv := first["divergenceScore"]
	if firstDiv == nil {
		t.Error("tier1 source should have non-nil divergenceScore")
	}
	secondDiv := second["divergenceScore"]
	if secondDiv != nil {
		t.Errorf("tier3 source should have null divergenceScore, got %v", secondDiv)
	}

	// Check state is "sourced" — tier1 is accessible
	if ann["state"] != "sourced" {
		t.Errorf("expected state=sourced, got %v", ann["state"])
	}

	// Check commentaryItems passed through
	items := ann["commentaryItems"].([]any)
	if len(items) != 1 {
		t.Errorf("expected 1 commentaryItem, got %d", len(items))
	}

	// Check usage summed
	usage := resp["usage"].(map[string]any)
	if usage["inputTokens"].(float64) != 100 {
		t.Errorf("expected inputTokens=100, got %v", usage["inputTokens"])
	}
	if usage["outputTokens"].(float64) != 50 {
		t.Errorf("expected outputTokens=50, got %v", usage["outputTokens"])
	}

	// Check evaluationFailed is false
	if ann["evaluationFailed"] != false {
		t.Errorf("expected evaluationFailed=false, got %v", ann["evaluationFailed"])
	}
}

func TestAnnotate_EmptyClaims_Returns400(t *testing.T) {
	provider := &mockProvider{}
	reqBody := map[string]any{
		"analysisId":      "test-analysis-2",
		"claims":          []any{},
		"evaluatedClaims": []any{},
	}

	rr := post(newHandler(provider), reqBody)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}

	var errResp map[string]string
	json.Unmarshal(rr.Body.Bytes(), &errResp)
	if errResp["code"] != "invalid_request" {
		t.Errorf("expected code=invalid_request, got %v", errResp["code"])
	}
}

func TestAnnotate_MalformedJSON_Returns400(t *testing.T) {
	provider := &mockProvider{}
	req := httptest.NewRequest(http.MethodPost, "/annotate", bytes.NewReader([]byte(`{not valid json}`)))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	newHandler(provider).ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}

	var errResp map[string]string
	json.Unmarshal(rr.Body.Bytes(), &errResp)
	if errResp["code"] != "invalid_request" {
		t.Errorf("expected code=invalid_request, got %v", errResp["code"])
	}
}

func TestAnnotate_LengthMismatch_Returns400(t *testing.T) {
	provider := &mockProvider{}
	reqBody := map[string]any{
		"analysisId": "test-analysis-3",
		"claims": []map[string]any{
			{"claimText": "Claim 1", "charOffset": 0, "charLength": 7, "riskLevel": "low", "riskReasoning": "n/a", "searchQuery": "claim 1"},
			{"claimText": "Claim 2", "charOffset": 8, "charLength": 7, "riskLevel": "low", "riskReasoning": "n/a", "searchQuery": "claim 2"},
		},
		"evaluatedClaims": []map[string]any{
			{"sources": []any{}, "commentaryItems": []any{}},
		},
	}

	rr := post(newHandler(provider), reqBody)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}

	var errResp map[string]string
	json.Unmarshal(rr.Body.Bytes(), &errResp)
	if errResp["code"] != "invalid_request" {
		t.Errorf("expected code=invalid_request, got %v", errResp["code"])
	}
}

func TestAnnotate_LLMFailure_EvaluationFailed(t *testing.T) {
	provider := &mockProvider{
		err: fmt.Errorf("anthropic returned 503"),
	}

	reqBody := map[string]any{
		"analysisId": "test-analysis-4",
		"claims": []map[string]any{
			{
				"claimText":     "Some factual claim",
				"charOffset":    0,
				"charLength":    18,
				"riskLevel":     "medium",
				"riskReasoning": "Controversial topic",
				"searchQuery":   "some factual claim",
			},
		},
		"evaluatedClaims": []map[string]any{
			{
				"sources": []map[string]any{
					{
						"url":        "https://example.com",
						"title":      "Example Source",
						"tier":       "tier1",
						"tierLabel":  "Tier 1",
						"summary":    "Example summary",
						"accessible": true,
					},
				},
				"commentaryItems": []any{},
			},
		},
	}

	rr := post(newHandler(provider), reqBody)

	// Should still return 200 — per-claim failure is not a 500
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(rr.Body.Bytes(), &resp)

	annotations := resp["annotations"].([]any)
	if len(annotations) != 1 {
		t.Fatalf("expected 1 annotation, got %d", len(annotations))
	}

	ann := annotations[0].(map[string]any)

	if ann["evaluationFailed"] != true {
		t.Errorf("expected evaluationFailed=true, got %v", ann["evaluationFailed"])
	}

	if ann["tensionRating"] != nil {
		t.Errorf("expected tensionRating=null when evaluationFailed, got %v", ann["tensionRating"])
	}

	// Usage should be zero since the LLM call failed
	usage := resp["usage"].(map[string]any)
	if usage["inputTokens"].(float64) != 0 {
		t.Errorf("expected inputTokens=0, got %v", usage["inputTokens"])
	}
}
