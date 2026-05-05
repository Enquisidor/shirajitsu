package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"time"

	"github.com/shirajitsu/annotator/internal/llm"
	"github.com/shirajitsu/annotator/internal/scoring"
)

// AnnotateHandler handles POST /annotate requests.
type AnnotateHandler struct {
	Provider llm.Provider
	Logger   *slog.Logger
}

// --- Request shapes ---

type annotateRequest struct {
	AnalysisID      string           `json:"analysisId"`
	Claims          []claimInput     `json:"claims"`
	EvaluatedClaims []evaluatedClaim `json:"evaluatedClaims"`
}

type claimInput struct {
	ClaimText     string `json:"claimText"`
	CharOffset    int    `json:"charOffset"`
	CharLength    int    `json:"charLength"`
	RiskLevel     string `json:"riskLevel"`
	RiskReasoning string `json:"riskReasoning"`
	SearchQuery   string `json:"searchQuery"`
}

type evaluatedClaim struct {
	Sources         []evaluatedSource `json:"sources"`
	CommentaryItems []any             `json:"commentaryItems"`
}

type evaluatedSource struct {
	URL        string `json:"url"`
	Title      string `json:"title"`
	Tier       string `json:"tier"`
	TierLabel  string `json:"tierLabel"`
	Summary    string `json:"summary"`
	Accessible bool   `json:"accessible"`
}

// --- Response shapes ---

type annotateResponse struct {
	Annotations []annotation `json:"annotations"`
	Usage       usageOutput  `json:"usage"`
}

type annotation struct {
	Claim            claimOutput      `json:"claim"`
	State            string           `json:"state"`
	TensionRating    *tensionOutput   `json:"tensionRating"`
	Sources          []sourceOutput   `json:"sources"`
	CommentaryItems  []any            `json:"commentaryItems"`
	GeneratedAt      string           `json:"generatedAt"`
	EvaluationFailed bool             `json:"evaluationFailed"`
}

type claimOutput struct {
	ClaimText     string `json:"claimText"`
	CharOffset    int    `json:"charOffset"`
	CharLength    int    `json:"charLength"`
	RiskLevel     string `json:"riskLevel"`
	RiskReasoning string `json:"riskReasoning"`
	SearchQuery   string `json:"searchQuery"`
}

type tensionOutput struct {
	Score       float64 `json:"score"`
	SourceCount int     `json:"sourceCount"`
	Label       string  `json:"label"`
}

type sourceOutput struct {
	URL             string   `json:"url"`
	Title           string   `json:"title"`
	Tier            string   `json:"tier"`
	TierLabel       string   `json:"tierLabel"`
	Summary         string   `json:"summary"`
	Accessible      bool     `json:"accessible"`
	RelevanceScore  float64  `json:"relevanceScore"`
	DivergenceScore *float64 `json:"divergenceScore"`
}

type usageOutput struct {
	InputTokens  int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
}

// ServeHTTP processes annotation requests.
func (h *AnnotateHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	requestID := r.Header.Get("X-Request-Id")

	var req annotateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Logger.Error("failed to decode request body", "err", err, "requestId", requestID, "service", "annotator")
		writeError(w, http.StatusBadRequest, "invalid request body", "invalid_request")
		return
	}

	if req.AnalysisID == "" {
		writeError(w, http.StatusBadRequest, "analysisId must not be empty", "invalid_request")
		return
	}
	if len(req.Claims) == 0 {
		writeError(w, http.StatusBadRequest, "claims must not be empty", "invalid_request")
		return
	}
	if len(req.Claims) != len(req.EvaluatedClaims) {
		writeError(w, http.StatusBadRequest, "claims and evaluatedClaims must have the same length", "invalid_request")
		return
	}

	annotations := make([]annotation, 0, len(req.Claims))
	totalUsage := usageOutput{}

	for i, claim := range req.Claims {
		evaluated := req.EvaluatedClaims[i]
		generatedAt := time.Now().UTC().Format(time.RFC3339)

		// Build SourceSummary slice for the LLM
		summaries := make([]llm.SourceSummary, len(evaluated.Sources))
		for j, src := range evaluated.Sources {
			summaries[j] = llm.SourceSummary{
				Index:   j,
				URL:     src.URL,
				Title:   src.Title,
				Snippet: src.Summary,
				Tier:    src.Tier,
			}
		}

		scores, usage, err := h.Provider.Score(r.Context(), claim.ClaimText, summaries)
		if err != nil {
			h.Logger.Error("LLM scoring failed", "err", err, "requestId", requestID, "service", "annotator", "claimIndex", i)

			// Build source outputs from input without scores
			srcOutputs := make([]sourceOutput, len(evaluated.Sources))
			for j, src := range evaluated.Sources {
				srcOutputs[j] = sourceOutput{
					URL:        src.URL,
					Title:      src.Title,
					Tier:       src.Tier,
					TierLabel:  src.TierLabel,
					Summary:    src.Summary,
					Accessible: src.Accessible,
				}
			}

			annotations = append(annotations, annotation{
				Claim: claimOutput{
					ClaimText:     claim.ClaimText,
					CharOffset:    claim.CharOffset,
					CharLength:    claim.CharLength,
					RiskLevel:     claim.RiskLevel,
					RiskReasoning: claim.RiskReasoning,
					SearchQuery:   claim.SearchQuery,
				},
				State:            string(scoring.DetermineState(toEvaluatedSources(evaluated.Sources))),
				TensionRating:    nil,
				Sources:          srcOutputs,
				CommentaryItems:  evaluated.CommentaryItems,
				GeneratedAt:      generatedAt,
				EvaluationFailed: true,
			})
			continue
		}

		// Accumulate usage
		totalUsage.InputTokens += usage.InputTokens
		totalUsage.OutputTokens += usage.OutputTokens

		// Build a score lookup by source index
		scoreByIndex := make(map[int]llm.SourceScore, len(scores))
		for _, sc := range scores {
			scoreByIndex[sc.SourceIndex] = sc
		}

		// Attach scores to sources
		srcOutputs := make([]sourceOutput, len(evaluated.Sources))
		for j, src := range evaluated.Sources {
			sc := scoreByIndex[j]
			srcOutputs[j] = sourceOutput{
				URL:             src.URL,
				Title:           src.Title,
				Tier:            src.Tier,
				TierLabel:       src.TierLabel,
				Summary:         src.Summary,
				Accessible:      src.Accessible,
				RelevanceScore:  sc.RelevanceScore,
				DivergenceScore: sc.DivergenceScore,
			}
		}

		// Sort sources descending by relevance score
		sort.Slice(srcOutputs, func(a, b int) bool {
			return srcOutputs[a].RelevanceScore > srcOutputs[b].RelevanceScore
		})

		// Compute tension rating
		tr := scoring.ComputeTensionRating(scores, summaries)
		var tensionOut *tensionOutput
		if tr != nil {
			tensionOut = &tensionOutput{
				Score:       tr.Score,
				SourceCount: tr.SourceCount,
				Label:       tr.Label(),
			}
		}

		// Determine state
		state := scoring.DetermineState(toEvaluatedSources(evaluated.Sources))

		annotations = append(annotations, annotation{
			Claim: claimOutput{
				ClaimText:     claim.ClaimText,
				CharOffset:    claim.CharOffset,
				CharLength:    claim.CharLength,
				RiskLevel:     claim.RiskLevel,
				RiskReasoning: claim.RiskReasoning,
				SearchQuery:   claim.SearchQuery,
			},
			State:            string(state),
			TensionRating:    tensionOut,
			Sources:          srcOutputs,
			CommentaryItems:  evaluated.CommentaryItems,
			GeneratedAt:      generatedAt,
			EvaluationFailed: false,
		})
	}

	resp := annotateResponse{
		Annotations: annotations,
		Usage:       totalUsage,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		h.Logger.Error("failed to encode response", "err", err, "requestId", requestID, "service", "annotator")
	}
}

// toEvaluatedSources converts handler-level source shapes to the scoring package type.
func toEvaluatedSources(srcs []evaluatedSource) []scoring.EvaluatedSource {
	out := make([]scoring.EvaluatedSource, len(srcs))
	for i, s := range srcs {
		out[i] = scoring.EvaluatedSource{
			Tier:       s.Tier,
			Accessible: s.Accessible,
		}
	}
	return out
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, status int, message, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{
		"error": message,
		"code":  code,
	})
}
