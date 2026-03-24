package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"os"

	"github.com/shirajitsu/gateway/internal/domain"
)

type analyzeHTTPRequest struct {
	Text           string           `json:"text"`
	Context        string           `json:"context"`
	PlatformUserID string           `json:"platformUserId,omitempty"`
	Model          *domain.AIModel  `json:"model,omitempty"` // user's model selection; nil = use service default
}

func Analyze(logger *slog.Logger) http.HandlerFunc {
	claimExtractorURL := env("CLAIM_EXTRACTOR_URL", "http://claim-extractor:8080")

	return func(w http.ResponseWriter, r *http.Request) {
		var body analyzeHTTPRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		req := domain.AnalyzeRequest{
			Text:           body.Text,
			Context:        domain.Context(body.Context),
			PlatformUserID: body.PlatformUserID,
			Model:          body.Model,
		}
		if err := req.Validate(); err != nil {
			http.Error(w, err.Error(), http.StatusUnprocessableEntity)
			return
		}

		// Forward to claim-extractor, including model selection so it can override its default
		payload, _ := json.Marshal(body)
		resp, err := http.Post(claimExtractorURL+"/extract", "application/json", bytes.NewReader(payload))
		if err != nil {
			logger.Error("claim-extractor unavailable", "err", err)
			http.Error(w, "upstream error", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
	}
}

func Healthz(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
