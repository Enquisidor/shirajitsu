package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"sync"

	"github.com/shirajitsu/source-evaluator/internal/commentary"
	"github.com/shirajitsu/source-evaluator/internal/domain"
	"github.com/shirajitsu/source-evaluator/internal/paywall"
	"github.com/shirajitsu/source-evaluator/internal/registry"
	"github.com/shirajitsu/source-evaluator/internal/search"
)

const maxSearchResults = 10

// evaluateRequest is the JSON body for POST /evaluate.
type evaluateRequest struct {
	SearchProvider string         `json:"searchProvider"`
	Claims         []domain.Claim `json:"claims"`
}

// sourceResponse is the JSON representation of a domain.Source in the response.
type sourceResponse struct {
	URL        string `json:"url"`
	Title      string `json:"title"`
	Tier       string `json:"tier"`
	TierLabel  string `json:"tierLabel"`
	Summary    string `json:"summary"`
	Accessible bool   `json:"accessible"`
}

// evaluatedClaimResponse is the JSON representation of a single evaluated claim.
type evaluatedClaimResponse struct {
	ClaimIndex      int                    `json:"claimIndex"`
	Sources         []sourceResponse       `json:"sources"`
	CommentaryItems []domain.CommentaryItem `json:"commentaryItems"`
}

// evaluateResponse is the top-level JSON response for POST /evaluate.
type evaluateResponse struct {
	RegistryVersion string                   `json:"registryVersion"`
	EvaluatedClaims []evaluatedClaimResponse `json:"evaluatedClaims"`
}

// errorResponse is the JSON body for error responses.
type errorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

// EvaluateHandler handles POST /evaluate requests.
// It classifies search results for each claim against the source registry.
type EvaluateHandler struct {
	loader   *registry.Loader
	provider search.Provider
	paywall  *paywall.Detector
	logger   *slog.Logger
}

// NewEvaluateHandler constructs an EvaluateHandler with the given dependencies.
func NewEvaluateHandler(
	loader *registry.Loader,
	provider search.Provider,
	detector *paywall.Detector,
	logger *slog.Logger,
) *EvaluateHandler {
	return &EvaluateHandler{
		loader:   loader,
		provider: provider,
		paywall:  detector,
		logger:   logger,
	}
}

// ServeHTTP implements http.Handler for the /evaluate endpoint.
func (h *EvaluateHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	requestID := r.Header.Get("X-Request-Id")
	ctx := r.Context()

	var req evaluateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Warn("evaluate: malformed request body",
			"err", err,
			"requestId", requestID,
			"service", "source-evaluator",
		)
		writeError(w, http.StatusBadRequest, "malformed request body", "invalid_request")
		return
	}

	if len(req.Claims) == 0 {
		h.logger.Warn("evaluate: empty claims array",
			"requestId", requestID,
			"service", "source-evaluator",
		)
		writeError(w, http.StatusBadRequest, "claims array must not be empty", "invalid_request")
		return
	}

	// Resolve the provider: use per-request override when searchProvider differs from default.
	provider := h.resolveProvider(ctx, req.SearchProvider, requestID)

	results, err := h.evaluateClaims(ctx, req.Claims, provider, requestID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "search provider unavailable: "+err.Error(), "upstream_error")
		return
	}

	resp := evaluateResponse{
		RegistryVersion: h.loader.Version(),
		EvaluatedClaims: results,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		h.logger.Error("evaluate: failed to encode response",
			"err", err,
			"requestId", requestID,
			"service", "source-evaluator",
		)
	}
}

// resolveProvider returns the appropriate search.Provider for the request.
// If searchProvider is set and differs from the default, a new one-off provider is constructed
// using environment-sourced API keys.
func (h *EvaluateHandler) resolveProvider(ctx context.Context, overrideName string, requestID string) search.Provider {
	if overrideName == "" || overrideName == h.provider.Name() {
		return h.provider
	}

	cfg := search.Config{
		Provider:    overrideName,
		APIKey:      os.Getenv("SEARCH_API_KEY"),
		GoogleCSEID: os.Getenv("GOOGLE_CSE_ID"),
	}
	p, err := search.New(cfg)
	if err != nil {
		h.logger.Warn("evaluate: unknown override provider, falling back to default",
			"override", overrideName,
			"err", err,
			"requestId", requestID,
			"service", "source-evaluator",
		)
		return h.provider
	}

	h.logger.Info("evaluate: using per-request provider override",
		"provider", overrideName,
		"requestId", requestID,
		"service", "source-evaluator",
	)
	return p
}

// evaluateClaims fans out one goroutine per claim and collects results.
// Returns an error only if every claim's search fails (caller maps to 502).
// Individual claim failures result in empty sources/commentaryItems for that claim.
func (h *EvaluateHandler) evaluateClaims(
	ctx context.Context,
	claims []domain.Claim,
	provider search.Provider,
	requestID string,
) ([]evaluatedClaimResponse, error) {
	results := make([]evaluatedClaimResponse, len(claims))
	errs := make([]error, len(claims))

	var wg sync.WaitGroup
	for i, claim := range claims {
		wg.Add(1)
		go func(idx int, c domain.Claim) {
			defer wg.Done()
			evaluated, err := h.evaluateSingleClaim(ctx, idx, c, provider, requestID)
			if err != nil {
				h.logger.Error("evaluate: claim search failed",
					"claimIndex", idx,
					"err", err,
					"requestId", requestID,
					"service", "source-evaluator",
				)
				errs[idx] = err
				// Return empty result for this claim so the response shape is preserved.
				results[idx] = evaluatedClaimResponse{
					ClaimIndex:      idx,
					Sources:         []sourceResponse{},
					CommentaryItems: []domain.CommentaryItem{},
				}
				return
			}
			results[idx] = evaluated
		}(i, claim)
	}
	wg.Wait()

	// If every single claim errored, surface a 502.
	allFailed := true
	for _, err := range errs {
		if err == nil {
			allFailed = false
			break
		}
	}
	if allFailed && len(claims) > 0 {
		return nil, errs[0]
	}

	return results, nil
}

// evaluateSingleClaim searches for a single claim and classifies the results.
func (h *EvaluateHandler) evaluateSingleClaim(
	ctx context.Context,
	idx int,
	claim domain.Claim,
	provider search.Provider,
	requestID string,
) (evaluatedClaimResponse, error) {
	searchResults, err := provider.Search(ctx, claim.SearchQuery, maxSearchResults)
	if err != nil {
		return evaluatedClaimResponse{}, err
	}

	sources := make([]sourceResponse, 0, len(searchResults))
	commentaryItems := make([]domain.CommentaryItem, 0)

	for _, result := range searchResults {
		if commentary.IsCommentary(result.URL) {
			commentaryItems = append(commentaryItems, domain.CommentaryItem{
				Text:            result.Snippet,
				SourceURL:       result.URL,
				AnchorSourceURL: result.URL,
				Label:           domain.CommentaryLabel,
			})
			continue
		}

		tier := registry.ClassifyURL(result.URL)
		accessible := h.paywall.IsAccessible(ctx, result.URL)

		sources = append(sources, sourceResponse{
			URL:        result.URL,
			Title:      result.Title,
			Tier:       string(tier),
			TierLabel:  domain.TierLabels[tier],
			Summary:    result.Snippet,
			Accessible: accessible,
		})
	}

	// Ensure non-nil slices for consistent JSON output.
	if sources == nil {
		sources = []sourceResponse{}
	}
	if commentaryItems == nil {
		commentaryItems = []domain.CommentaryItem{}
	}

	h.logger.Info("evaluate: claim evaluated",
		"claimIndex", idx,
		"sourceCount", len(sources),
		"commentaryCount", len(commentaryItems),
		"requestId", requestID,
		"service", "source-evaluator",
	)

	return evaluatedClaimResponse{
		ClaimIndex:      idx,
		Sources:         sources,
		CommentaryItems: commentaryItems,
	}, nil
}

// writeError writes a JSON error response with the given status code.
func writeError(w http.ResponseWriter, status int, message, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorResponse{Error: message, Code: code})
}
