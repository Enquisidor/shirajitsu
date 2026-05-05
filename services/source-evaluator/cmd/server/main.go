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

	"github.com/shirajitsu/source-evaluator/internal/handler"
	"github.com/shirajitsu/source-evaluator/internal/paywall"
	"github.com/shirajitsu/source-evaluator/internal/registry"
	"github.com/shirajitsu/source-evaluator/internal/search"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	// Cancellable context — cancelled on SIGTERM/SIGINT for graceful shutdown.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	// Registry loader — exits on failure to parse the initial registry file.
	registryPath := env("REGISTRY_PATH", "source-registry.json")
	loader, err := registry.NewLoader(registryPath, logger)
	if err != nil {
		logger.Error("source-evaluator: failed to load registry",
			"path", registryPath,
			"err", err,
			"service", "source-evaluator",
		)
		os.Exit(1)
	}
	go loader.Watch(ctx)

	// Paywall detector — weekly background recheck for cached domains.
	detector := paywall.New(logger)
	detector.StartWeeklyRechecker(ctx)

	// Default search provider — loaded from env vars.
	searchCfg := search.ConfigFromEnv()
	provider, err := search.New(searchCfg)
	if err != nil {
		logger.Error("source-evaluator: failed to initialise search provider",
			"provider", searchCfg.Provider,
			"err", err,
			"service", "source-evaluator",
		)
		os.Exit(1)
	}

	// HTTP router.
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	evalHandler := handler.NewEvaluateHandler(loader, provider, detector, logger)
	r.Post("/evaluate", evalHandler.ServeHTTP)

	addr := ":" + env("PORT", "8082")
	logger.Info("source-evaluator starting",
		"addr", addr,
		"registry", registryPath,
		"searchProvider", provider.Name(),
		"service", "source-evaluator",
	)

	if err := http.ListenAndServe(addr, r); err != nil {
		logger.Error("source-evaluator: server failed",
			"err", err,
			"service", "source-evaluator",
		)
		os.Exit(1)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
