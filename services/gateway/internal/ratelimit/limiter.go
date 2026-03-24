package ratelimit

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/shirajitsu/gateway/internal/auth"
)

type Limiter interface {
	Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, error)
}

type RedisLimiter struct {
	client *redis.Client
	logger *slog.Logger
}

func NewRedisLimiter(addr string, logger *slog.Logger) *RedisLimiter {
	return &RedisLimiter{
		client: redis.NewClient(&redis.Options{Addr: addr}),
		logger: logger,
	}
}

func (l *RedisLimiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	pipe := l.client.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		return false, err
	}
	return incr.Val() <= int64(limit), nil
}

func Middleware(limiter Limiter, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			principal := auth.PrincipalFrom(r.Context())
			if principal == nil {
				next.ServeHTTP(w, r)
				return
			}

			key := rateLimitKey(principal)
			// Default: 60 requests per minute per principal
			allowed, err := limiter.Allow(r.Context(), key, 60, time.Minute)
			if err != nil {
				logger.Error("rate limit check failed", "err", err)
				// Fail open — don't block on Redis errors
				next.ServeHTTP(w, r)
				return
			}

			if !allowed {
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func rateLimitKey(p *auth.Principal) string {
	if p.PlatformUserID != "" {
		return fmt.Sprintf("rl:platform:%s:user:%s", p.ID, p.PlatformUserID)
	}
	return fmt.Sprintf("rl:%s:%s", p.Type, p.ID)
}
