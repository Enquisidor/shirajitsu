package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/shirajitsu/gateway/internal/domain"
	"github.com/shirajitsu/gateway/internal/pipeline"
)

// analyzeHTTPRequest is the JSON body accepted by POST /v1/analyze.
type analyzeHTTPRequest struct {
	Text           string          `json:"text"`
	Context        string          `json:"context"`
	SearchProvider string          `json:"searchProvider,omitempty"`
	PlatformUserID string          `json:"platformUserId,omitempty"`
	Model          *domain.AIModel `json:"model,omitempty"`
}

// Analyze returns an http.HandlerFunc that runs the full pipeline and returns an AnalyzeResponse.
func Analyze(logger *slog.Logger, p *pipeline.Pipeline) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body analyzeHTTPRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeErrorJSON(w, http.StatusBadRequest, "invalid request body", "invalid_request")
			return
		}

		if body.Text == "" {
			writeErrorJSON(w, http.StatusBadRequest, "text must not be empty", "invalid_request")
			return
		}

		req := domain.AnalyzeRequest{
			Text:           body.Text,
			Context:        domain.Context(body.Context),
			SearchProvider: body.SearchProvider,
			PlatformUserID: body.PlatformUserID,
			Model:          body.Model,
		}

		// Context validation: default to "reader" if not supplied for backward compatibility,
		// but reject any explicitly invalid value.
		if req.Context == "" {
			req.Context = domain.ContextReader
		}
		if err := req.Validate(); err != nil {
			writeErrorJSON(w, http.StatusUnprocessableEntity, err.Error(), "validation_error")
			return
		}

		resp, err := p.Run(r.Context(), req)
		if err != nil {
			logger.Error("pipeline error", "err", err)
			writeErrorJSON(w, http.StatusBadGateway, "pipeline error", err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			logger.Error("failed to encode response", "err", err)
		}
	}
}

// Healthz returns a simple JSON health check response.
func Healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// writeErrorJSON writes a JSON error body with the shape {"error": ..., "detail": ...}.
func writeErrorJSON(w http.ResponseWriter, status int, errMsg, detail string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{
		"error":  errMsg,
		"detail": detail,
	})
}
