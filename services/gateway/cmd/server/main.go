package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/shirajitsu/gateway/internal/auth"
	"github.com/shirajitsu/gateway/internal/handlers"
	"github.com/shirajitsu/gateway/internal/ratelimit"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	redisAddr := env("REDIS_ADDR", "localhost:6379")
	limiter := ratelimit.NewRedisLimiter(redisAddr, logger)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(auth.Middleware(logger))
	r.Use(ratelimit.Middleware(limiter, logger))

	r.Post("/v1/analyze", handlers.Analyze(logger))
	r.Get("/healthz", handlers.Healthz)

	addr := env("PORT", "8080")
	logger.Info("gateway starting", "addr", addr)
	if err := http.ListenAndServe(":"+addr, r); err != nil {
		logger.Error("server failed", "err", err)
		os.Exit(1)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
