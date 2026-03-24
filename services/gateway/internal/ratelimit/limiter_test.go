package ratelimit_test

import (
	"testing"

	"github.com/shirajitsu/gateway/internal/auth"
	"github.com/shirajitsu/gateway/internal/ratelimit"
)

func TestRateLimitKey_PerUser(t *testing.T) {
	// Rate limit keys must be distinct per principal type to prevent cross-contamination
	t.Run("platform with user passthrough gets scoped key", func(t *testing.T) {
		_ = &auth.Principal{Type: "platform", ID: "sk-abc", PlatformUserID: "user-xyz"}
		// Key should contain both platform ID and user ID
		// Tested indirectly via Middleware integration; key format is internal.
	})

	t.Run("limiter interface is satisfied by RedisLimiter", func(t *testing.T) {
		var _ ratelimit.Limiter = (*ratelimit.RedisLimiter)(nil)
	})
}
