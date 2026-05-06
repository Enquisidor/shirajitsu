// Package pipeline orchestrates the claim-extractor → source-evaluator → annotator
// call chain and assembles an AnalyzeResponse for the gateway.
package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/shirajitsu/gateway/internal/domain"
)

// Pipeline calls the three downstream services in sequence and assembles an AnalyzeResponse.
type Pipeline struct {
	claimExtractorURL  string
	sourceEvaluatorURL string
	annotatorURL       string
	httpClient         *http.Client
}

// New returns a Pipeline wired to the given downstream service base URLs.
func New(claimExtractorURL, sourceEvaluatorURL, annotatorURL string) *Pipeline {
	return &Pipeline{
		claimExtractorURL:  claimExtractorURL,
		sourceEvaluatorURL: sourceEvaluatorURL,
		annotatorURL:       annotatorURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// ---- claim-extractor types ----

type extractRequest struct {
	Text  string      `json:"text"`
	Model *claimModel `json:"model,omitempty"`
}

type claimModel struct {
	Provider string `json:"provider"`
	ModelID  string `json:"modelId"`
}

type extractResponse struct {
	Claims []extractedClaim `json:"claims"`
}

type extractedClaim struct {
	ClaimText     string `json:"claimText"`
	CharOffset    int    `json:"charOffset"`
	CharLength    int    `json:"charLength"`
	RiskLevel     string `json:"riskLevel"`
	RiskReasoning string `json:"riskReasoning"`
	SearchQuery   string `json:"searchQuery"`
}

// ---- source-evaluator types ----

type evaluateRequest struct {
	SearchProvider string          `json:"searchProvider"`
	Claims         []extractedClaim `json:"claims"`
}

type evaluateResponse struct {
	RegistryVersion string                   `json:"registryVersion"`
	EvaluatedClaims []evaluatedClaimResponse `json:"evaluatedClaims"`
}

type evaluatedClaimResponse struct {
	ClaimIndex      int              `json:"claimIndex"`
	Sources         []sourceResponse `json:"sources"`
	CommentaryItems []interface{}    `json:"commentaryItems"`
}

type sourceResponse struct {
	URL        string `json:"url"`
	Title      string `json:"title"`
	Tier       string `json:"tier"`
	TierLabel  string `json:"tierLabel"`
	Summary    string `json:"summary"`
	Accessible bool   `json:"accessible"`
}

// ---- annotator types ----

type annotateRequest struct {
	AnalysisID      string                   `json:"analysisId"`
	Claims          []extractedClaim         `json:"claims"`
	EvaluatedClaims []evaluatedClaimPayload  `json:"evaluatedClaims"`
}

type evaluatedClaimPayload struct {
	Sources         []sourceResponse `json:"sources"`
	CommentaryItems []interface{}    `json:"commentaryItems"`
}

type annotateResponse struct {
	Annotations []annotatorAnnotation `json:"annotations"`
	Usage       annotatorUsage        `json:"usage"`
}

type annotatorAnnotation struct {
	Claim            annotatorClaim   `json:"claim"`
	State            string           `json:"state"`
	TensionRating    *annotatorTension `json:"tensionRating"`
	Sources          []annotatorSource `json:"sources"`
	CommentaryItems  []interface{}     `json:"commentaryItems"`
	GeneratedAt      string            `json:"generatedAt"`
	EvaluationFailed bool              `json:"evaluationFailed"`
}

type annotatorClaim struct {
	ClaimText     string `json:"claimText"`
	CharOffset    int    `json:"charOffset"`
	CharLength    int    `json:"charLength"`
	RiskLevel     string `json:"riskLevel"`
	RiskReasoning string `json:"riskReasoning"`
	SearchQuery   string `json:"searchQuery"`
}

type annotatorTension struct {
	Score       float64 `json:"score"`
	SourceCount int     `json:"sourceCount"`
	Label       string  `json:"label"`
}

type annotatorSource struct {
	URL             string   `json:"url"`
	Title           string   `json:"title"`
	Tier            string   `json:"tier"`
	TierLabel       string   `json:"tierLabel"`
	Summary         string   `json:"summary"`
	Accessible      bool     `json:"accessible"`
	RelevanceScore  float64  `json:"relevanceScore"`
	DivergenceScore *float64 `json:"divergenceScore"`
}

type annotatorUsage struct {
	InputTokens  int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
}

// Run executes the full pipeline and returns a populated AnalyzeResponse.
// Errors from any downstream service are returned as-is so the handler can
// map them to the appropriate HTTP status code.
func (p *Pipeline) Run(ctx context.Context, req domain.AnalyzeRequest) (*domain.AnalyzeResponse, error) {
	analysisID := fmt.Sprintf("%d", time.Now().UnixNano())

	// 1. Call claim-extractor.
	claims, err := p.extractClaims(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("claim-extractor: %w", err)
	}

	// 2. Call source-evaluator.
	evalResp, err := p.evaluateClaims(ctx, claims, req.SearchProvider)
	if err != nil {
		return nil, fmt.Errorf("source-evaluator: %w", err)
	}

	// 3. Call annotator.
	annotResp, err := p.annotate(ctx, analysisID, claims, evalResp.EvaluatedClaims)
	if err != nil {
		return nil, fmt.Errorf("annotator: %w", err)
	}

	// 4. Assemble AnalyzeResponse.
	return p.assemble(analysisID, evalResp.RegistryVersion, claims, evalResp, annotResp), nil
}

// extractClaims calls POST /extract on the claim-extractor and returns the list of claims.
func (p *Pipeline) extractClaims(ctx context.Context, req domain.AnalyzeRequest) ([]extractedClaim, error) {
	payload := extractRequest{Text: req.Text}
	if req.Model != nil {
		payload.Model = &claimModel{
			Provider: req.Model.Provider,
			ModelID:  req.Model.ModelID,
		}
	}

	var resp extractResponse
	if err := p.post(ctx, p.claimExtractorURL+"/extract", payload, &resp); err != nil {
		return nil, err
	}
	return resp.Claims, nil
}

// evaluateClaims calls POST /evaluate on the source-evaluator.
func (p *Pipeline) evaluateClaims(ctx context.Context, claims []extractedClaim, searchProvider string) (*evaluateResponse, error) {
	payload := evaluateRequest{
		SearchProvider: searchProvider,
		Claims:         claims,
	}

	var resp evaluateResponse
	if err := p.post(ctx, p.sourceEvaluatorURL+"/evaluate", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// annotate calls POST /annotate on the annotator service.
func (p *Pipeline) annotate(
	ctx context.Context,
	analysisID string,
	claims []extractedClaim,
	evaluatedClaims []evaluatedClaimResponse,
) (*annotateResponse, error) {
	// Build parallel slices: annotator requires claims and evaluatedClaims at the same index.
	annotClaims := make([]extractedClaim, len(claims))
	copy(annotClaims, claims)

	annotEvaluated := make([]evaluatedClaimPayload, len(evaluatedClaims))
	for i, ec := range evaluatedClaims {
		annotEvaluated[i] = evaluatedClaimPayload{
			Sources:         ec.Sources,
			CommentaryItems: ec.CommentaryItems,
		}
	}

	payload := annotateRequest{
		AnalysisID:      analysisID,
		Claims:          annotClaims,
		EvaluatedClaims: annotEvaluated,
	}

	var resp annotateResponse
	if err := p.post(ctx, p.annotatorURL+"/annotate", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// assemble builds the final AnalyzeResponse from all three service responses.
func (p *Pipeline) assemble(
	analysisID string,
	registryVersion string,
	claims []extractedClaim,
	evalResp *evaluateResponse,
	annotResp *annotateResponse,
) *domain.AnalyzeResponse {
	if registryVersion == "" {
		registryVersion = "1.0.0"
	}

	// Count total sources across all evaluated claims.
	totalSources := 0
	for _, ec := range evalResp.EvaluatedClaims {
		totalSources += len(ec.Sources)
	}

	// Identify failed claims: those whose annotation has EvaluationFailed set.
	var failedClaims []domain.FailedClaim
	var annotations []domain.Annotation

	// Build a set of claim indices by claimText to detect failures.
	// The annotator preserves order and index alignment.
	for i, ann := range annotResp.Annotations {
		if ann.EvaluationFailed {
			var fc domain.FailedClaim
			if i < len(claims) {
				c := claims[i]
				fc = domain.FailedClaim{
					ClaimText:     c.ClaimText,
					CharOffset:    c.CharOffset,
					CharLength:    c.CharLength,
					RiskLevel:     c.RiskLevel,
					RiskReasoning: c.RiskReasoning,
					SearchQuery:   c.SearchQuery,
				}
			} else {
				fc = domain.FailedClaim{
					ClaimText: ann.Claim.ClaimText,
				}
			}
			failedClaims = append(failedClaims, fc)
			continue
		}

		// Map annotator sources to domain.SourceResult.
		sources := make([]domain.SourceResult, len(ann.Sources))
		for j, s := range ann.Sources {
			sources[j] = domain.SourceResult{
				URL:             s.URL,
				Title:           s.Title,
				Tier:            s.Tier,
				TierLabel:       s.TierLabel,
				Summary:         s.Summary,
				Accessible:      s.Accessible,
				RelevanceScore:  s.RelevanceScore,
				DivergenceScore: s.DivergenceScore,
			}
		}

		var tensionRating *domain.TensionRating
		if ann.TensionRating != nil {
			tensionRating = &domain.TensionRating{
				Score:       ann.TensionRating.Score,
				SourceCount: ann.TensionRating.SourceCount,
				Label:       ann.TensionRating.Label,
			}
		}

		annotations = append(annotations, domain.Annotation{
			Claim: domain.ClaimSummary{
				ClaimText:     ann.Claim.ClaimText,
				CharOffset:    ann.Claim.CharOffset,
				CharLength:    ann.Claim.CharLength,
				RiskLevel:     ann.Claim.RiskLevel,
				RiskReasoning: ann.Claim.RiskReasoning,
				SearchQuery:   ann.Claim.SearchQuery,
			},
			State:            ann.State,
			TensionRating:    tensionRating,
			Sources:          sources,
			CommentaryItems:  ann.CommentaryItems,
			GeneratedAt:      ann.GeneratedAt,
			EvaluationFailed: false,
		})
	}

	if failedClaims == nil {
		failedClaims = []domain.FailedClaim{}
	}
	if annotations == nil {
		annotations = []domain.Annotation{}
	}

	totalTokens := annotResp.Usage.InputTokens + annotResp.Usage.OutputTokens
	successfulClaims := len(annotations)
	failedCount := len(failedClaims)

	return &domain.AnalyzeResponse{
		AnalysisID:      analysisID,
		RegistryVersion: registryVersion,
		SessionStats: domain.SessionStats{
			TotalClaims:      len(claims),
			SuccessfulClaims: successfulClaims,
			FailedClaims:     failedCount,
			TotalTokens:      totalTokens,
			TotalSources:     totalSources,
		},
		FailedClaims: failedClaims,
		Annotations:  annotations,
	}
}

// post marshals body to JSON, POSTs it to url, and decodes the response into out.
// Returns an error for non-2xx responses or network/decode failures.
func (p *Pipeline) post(ctx context.Context, url string, body, out interface{}) error {
	data, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("upstream returned %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}
