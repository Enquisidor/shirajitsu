package auth

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
)

type Principal struct {
	Type           string // "user" | "platform"
	ID             string
	PlatformUserID string // set when type == "platform" and passthrough provided
}

type contextKey struct{}

func Middleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			principal, err := extractPrincipal(r)
			if err != nil {
				logger.Warn("auth failed", "err", err)
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), contextKey{}, principal)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func PrincipalFrom(ctx context.Context) *Principal {
	p, _ := ctx.Value(contextKey{}).(*Principal)
	return p
}

func extractPrincipal(r *http.Request) (*Principal, error) {
	// Platform API key
	if key := r.Header.Get("X-API-Key"); key != "" {
		// TODO: validate key against database
		p := &Principal{Type: "platform", ID: key}
		if uid := r.Header.Get("X-Platform-User-ID"); uid != "" {
			p.PlatformUserID = uid
		}
		return p, nil
	}

	// Clerk user JWT
	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		token := strings.TrimPrefix(auth, "Bearer ")
		// TODO: verify JWT with Clerk SDK
		_ = token
		return &Principal{Type: "user", ID: "todo-clerk-verify"}, nil
	}

	return nil, errUnauthenticated
}

var errUnauthenticated = &authError{"no valid credentials provided"}

type authError struct{ msg string }

func (e *authError) Error() string { return e.msg }
