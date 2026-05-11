package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strings"

	clerk "github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
)

// Principal represents an authenticated caller: either a Clerk user or a platform API key holder.
type Principal struct {
	Type           string // "user" | "platform"
	ID             string
	PlatformUserID string // set when type == "platform" and X-Platform-User-ID header is present
}

type contextKey struct{}

// Middleware returns a chi-compatible middleware that authenticates each request.
// It accepts either an X-API-Key header (platform API key) or a Bearer JWT (Clerk user token).
// When CLERK_SECRET_KEY is empty, JWT verification is skipped (local dev mode).
func Middleware(logger *slog.Logger) func(http.Handler) http.Handler {
	secretKey := os.Getenv("CLERK_SECRET_KEY")
	if secretKey == "" {
		logger.Warn("CLERK_SECRET_KEY is not set; JWT verification will be skipped (local dev mode)")
	} else {
		clerk.SetKey(secretKey)
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			principal, err := extractPrincipal(r, secretKey)
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

// PrincipalFrom retrieves the authenticated Principal from the request context.
// Returns nil if the context carries no Principal (e.g. health check routes).
func PrincipalFrom(ctx context.Context) *Principal {
	p, _ := ctx.Value(contextKey{}).(*Principal)
	return p
}

// extractPrincipal resolves the caller identity from request headers.
func extractPrincipal(r *http.Request, clerkSecretKey string) (*Principal, error) {
	// Platform API key — takes precedence over Bearer JWT.
	if key := r.Header.Get("X-API-Key"); key != "" {
		// TODO: validate key against database.
		p := &Principal{Type: "platform", ID: key}
		if uid := r.Header.Get("X-Platform-User-ID"); uid != "" {
			p.PlatformUserID = uid
		}
		return p, nil
	}

	// Clerk user JWT.
	if authHeader := r.Header.Get("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")

		// When CLERK_SECRET_KEY is not configured, skip verification (local dev).
		if clerkSecretKey == "" {
			return &Principal{Type: "user", ID: "unverified-local-dev"}, nil
		}

		claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{Token: token})
		if err != nil {
			return nil, errors.New("invalid JWT: " + err.Error())
		}

		return &Principal{Type: "user", ID: claims.Subject}, nil
	}

	return nil, errUnauthenticated
}

var errUnauthenticated = &authError{"no valid credentials provided"}

type authError struct{ msg string }

func (e *authError) Error() string { return e.msg }
