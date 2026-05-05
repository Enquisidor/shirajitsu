package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/shirajitsu/annotator/internal/handler"
	"github.com/shirajitsu/annotator/internal/llm"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg := llm.ConfigFromEnv()
	provider, err := llm.New(cfg)
	if err != nil {
		logger.Error("failed to initialise LLM provider", "err", err, "service", "annotator")
		os.Exit(1)
	}
	logger.Info("LLM provider initialised", "provider", cfg.Provider, "model", cfg.Model, "service", "annotator")

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)

	annotateHandler := &handler.AnnotateHandler{
		Provider: provider,
		Logger:   logger,
	}

	r.Post("/annotate", annotateHandler.ServeHTTP)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	addr := ":" + env("PORT", "8083")
	srv := &http.Server{Addr: addr, Handler: r}

	// Graceful shutdown on SIGTERM/SIGINT
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	go func() {
		logger.Info("annotator starting", "addr", addr, "service", "annotator")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", "err", err, "service", "annotator")
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down", "service", "annotator")
	if err := srv.Shutdown(context.Background()); err != nil {
		logger.Error("shutdown error", "err", err, "service", "annotator")
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
