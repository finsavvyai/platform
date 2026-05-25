//go:build integration

package integration

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	ratelimit "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
	mw "github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/middleware"
)

// TestIntegration_RateLimiter_100Allow_101Block verifies that a tenant with a
// 100 RPM limit is allowed 100 requests and denied on the 101st, with a
// positive retryAfter on the 429 result.
func TestIntegration_RateLimiter_100Allow_101Block(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	defer mr.Close()

	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer client.Close()

	store := ratelimit.NewMapConfigStore()
	store.Set("integration-tenant", "/v1/rag/query", ratelimit.RouteRule{
		RequestsPerMinute: 100,
		Burst:             100,
	})
	limiter := ratelimit.NewRedisLimiter(client, store)

	ctx := context.Background()

	// First 100 requests must be allowed.
	for i := 0; i < 100; i++ {
		allowed, _, err := limiter.Allow(ctx, "integration-tenant", "/v1/rag/query", 1)
		require.NoErrorf(t, err, "request %d", i+1)
		assert.Truef(t, allowed, "request %d should be allowed", i+1)
	}

	// 101st must be denied with a positive retry-after.
	allowed, retryAfter, err := limiter.Allow(ctx, "integration-tenant", "/v1/rag/query", 1)
	require.NoError(t, err)
	assert.False(t, allowed, "101st request must be blocked")
	assert.Greater(t, retryAfter, time.Duration(0), "retry-after must be positive")
}

// TestIntegration_SlidingWindow_Middleware_429 verifies the HTTP middleware
// emits 429 + Retry-After once the tenant's per-route limit is hit.
func TestIntegration_SlidingWindow_Middleware_429(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	defer mr.Close()

	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer client.Close()

	store := ratelimit.NewMapConfigStore()
	store.Set("mw-tenant", "/test", ratelimit.RouteRule{RequestsPerMinute: 2, Burst: 2})
	limiter := ratelimit.NewRedisLimiter(client, store)

	handler := mw.SlidingWindow(limiter)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	call := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req = req.WithContext(context.WithValue(req.Context(), mw.CtxKeyTenantID, "mw-tenant"))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}

	assert.Equal(t, http.StatusOK, call().Code, "first request must pass")
	assert.Equal(t, http.StatusOK, call().Code, "second request must pass")

	rec := call()
	assert.Equal(t, http.StatusTooManyRequests, rec.Code, "third request must be blocked")
	assert.NotEmpty(t, rec.Header().Get("Retry-After"), "Retry-After must be set on 429")
}
