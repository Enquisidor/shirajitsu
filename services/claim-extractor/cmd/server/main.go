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
			Text  string     `json:"text"`
			Model *llm.Model `json:"model,omitempty"` // user's selection; nil = use server default
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		if body.Text == "" {
			http.Error(w, "text must not be empty", http.StatusUnprocessableEntity)
			return
		}

		// Use request-scoped provider if the user specified a model, else use the server default
		p := provider
		if body.Model != nil && body.Model.Provider != "" && body.Model.ModelID != "" {
			override, err := llm.New(llm.Config{
				Provider: body.Model.Provider,
				Model:    body.Model.ModelID,
				APIKey:   cfg.APIKey, // reuse server-side API key
				BaseURL:  cfg.BaseURL,
			})
			if err != nil {
				http.Error(w, "unsupported model: "+err.Error(), http.StatusBadRequest)
				return
			}
			p = override
		}

		claims, err := p.Extract(r.Context(), body.Text)
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
