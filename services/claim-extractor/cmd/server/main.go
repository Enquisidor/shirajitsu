package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/shirajitsu/claim-extractor/internal/llm"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg := llm.ConfigFromEnv()
	provider, err := llm.New(cfg)
	if err != nil {
		logger.Error("failed to initialise LLM provider", "err", err)
		os.Exit(1)
	}
	logger.Info("LLM provider initialised", "provider", cfg.Provider, "model", cfg.Model)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)

	r.Post("/extract", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		if body.Text == "" {
			http.Error(w, "text must not be empty", http.StatusUnprocessableEntity)
			return
		}

		claims, err := provider.Extract(r.Context(), body.Text)
		if err != nil {
			logger.Error("extraction failed", "err", err)
			http.Error(w, "extraction failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"claims": claims})
	})

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	addr := ":" + envOr("PORT", "8080")
	logger.Info("claim-extractor starting", "addr", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		logger.Error("server failed", "err", err)
		os.Exit(1)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
