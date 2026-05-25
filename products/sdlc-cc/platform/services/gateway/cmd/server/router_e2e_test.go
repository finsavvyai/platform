package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/discovery"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/health"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
)

const (
	testJWTSecret = "test-jwt-secret-32-chars-minimum!!"
	testJWTIssuer = "sdlc-platform-test"
)

// buildTestApp constructs an Application with stubbed dependencies for HTTP
// layer tests. DB and PolicyEngine are left nil — routes that touch the DB
// are not exercised here (covered by DB integration tests).
func buildTestApp(t *testing.T, limiter *ratelimit.TierRateLimiter) *Application {
	t.Helper()

	cfg := &config.Config{
		Version:     "test",
		Environment: "test",
		InstanceID:  "test-instance",
		StartTime:   time.Now(),
		JWT: config.JWTConfig{
			Secret: testJWTSecret,
			Issuer: testJWTIssuer,
		},
		OPA: config.OPAConfig{
			Enabled:       false,
			DenyByDefault: true,
		},
		Server: config.ServerConfig{
			Port:         0,
			ReadTimeout:  5 * time.Second,
			WriteTimeout: 5 * time.Second,
			IdleTimeout:  5 * time.Second,
		},
	}

	logger := observability.NewLogger(observability.LoggingConfig{Level: "error"}, "gateway-test")

	app := &Application{
		Config:          cfg,
		Logger:          logger,
		ServiceRegistry: discovery.NewServiceRegistry(cfg),
		HealthRegistry:  health.NewRegistry(cfg),
		CircuitRegistry: circuitbreaker.NewRegistry(),
		RateLimiter:     limiter,
	}
	return app
}

func newRouterServer(t *testing.T, limiter *ratelimit.TierRateLimiter) *httptest.Server {
	t.Helper()
	app := buildTestApp(t, limiter)
	passthrough := func(next http.Handler) http.Handler { return next }
	ts := httptest.NewServer(app.setupRouter(passthrough))
	t.Cleanup(ts.Close)
	return ts
}

// authedGet is for routes behind the golden-chain auth middleware. The chain
// now rejects requests without a Bearer token (security S2 fix); tests that
// exercise authenticated surfaces must present one.
func authedGet(t *testing.T, url string) *http.Response {
	t.Helper()
	return authedGetForTenant(t, url, "tenant-a")
}

func authedGetForTenant(t *testing.T, url, tenantID string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", signedAccessToken(t, tenantID))
	req.Header.Set("X-Tenant-ID", tenantID)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	return resp
}

func signedAccessToken(t *testing.T, tenantID string) string {
	t.Helper()
	now := time.Now()
	userID := uuid.NewString()
	token, err := jwt.NewBuilder().
		Subject(userID).
		Issuer(testJWTIssuer).
		Claim("user_id", userID).
		Claim("tenant_id", tenantID).
		Claim("token_type", "access").
		IssuedAt(now).
		NotBefore(now.Add(-1 * time.Minute)).
		Expiration(now.Add(15 * time.Minute)).
		Build()
	require.NoError(t, err)
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.HS256, []byte(testJWTSecret)))
	require.NoError(t, err)
	return "Bearer " + string(signed)
}

func TestRouter_Health_200(t *testing.T) {
	ts := newRouterServer(t, nil)
	for _, path := range []string{"/health", "/api/health", "/health/ready", "/health/live"} {
		resp, err := http.Get(ts.URL + path)
		require.NoError(t, err, path)
		resp.Body.Close()
		assert.Less(t, resp.StatusCode, 500, path)
	}
}

func TestRouter_Metrics_Exposes(t *testing.T) {
	ts := newRouterServer(t, nil)
	resp, err := http.Get(ts.URL + "/metrics")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestRouter_Version_ReturnsJSON(t *testing.T) {
	ts := newRouterServer(t, nil)
	resp, err := http.Get(ts.URL + "/version")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "test", body["version"])
	assert.Equal(t, "test", body["environment"])
}

func TestRouter_Info_ReturnsSystemFields(t *testing.T) {
	ts := newRouterServer(t, nil)
	resp, err := http.Get(ts.URL + "/info")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "SDLC.ai Gateway", body["service"])
	assert.NotNil(t, body["system"])
	assert.NotNil(t, body["discovery"])
}

func TestRouter_Services_ListEmpty(t *testing.T) {
	ts := newRouterServer(t, nil)
	resp := authedGet(t, ts.URL+"/services")
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.EqualValues(t, 0, body["count"])
}

func TestRouter_Services_GetUnknown404(t *testing.T) {
	ts := newRouterServer(t, nil)
	resp := authedGet(t, ts.URL+"/services/does-not-exist")
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestRouter_OpenClaw_Capabilities_200(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "docs", "channels"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(root, "docs", "channels", "slack.md"), []byte("# x"), 0o644))
	t.Setenv("OPENCLAW_ROOT", root)

	ts := newRouterServer(t, nil)
	resp := authedGet(t, ts.URL+"/api/v1/openclaw/capabilities")
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestRouter_OpenClaw_Health_Responds(t *testing.T) {
	t.Setenv("OPENCLAW_ROOT", t.TempDir())
	ts := newRouterServer(t, nil)
	resp := authedGet(t, ts.URL+"/api/v1/openclaw/health")
	defer resp.Body.Close()
	// Either 200 (available) or 503 (unavailable) — always decodes JSON.
	assert.Contains(t, []int{http.StatusOK, http.StatusServiceUnavailable}, resp.StatusCode)
}

func TestRouter_RateLimit_Blocks(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	limiter := ratelimit.NewTierRateLimiter(rdb)
	limiter.SetTierConfig("tiny", ratelimit.TierConfig{
		Name: "tiny", RequestsPerMin: 1, RequestsPerHour: 100,
		RequestsPerDay: 1000, ConcurrentLimit: 10, MaxPayloadBytes: 1024,
	})

	ts := newRouterServer(t, limiter)

	call := func() int {
		req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, ts.URL+"/api/v1/claw/health", nil)
		req.Header.Set("Authorization", signedAccessToken(t, "tenant-a"))
		req.Header.Set("X-Tenant-ID", "tenant-a")
		req.Header.Set("X-Tenant-Tier", "tiny")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()
		return resp.StatusCode
	}

	// First call passes limiter (handler returns 503 since Claw is not wired in test).
	first := call()
	assert.NotEqual(t, http.StatusTooManyRequests, first)
	// Second call is blocked by the minute-window limiter.
	assert.Equal(t, http.StatusTooManyRequests, call())
}

func TestRouter_Unauthenticated_Returns401(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	limiter := ratelimit.NewTierRateLimiter(rdb)
	ts := newRouterServer(t, limiter)

	// Auth middleware short-circuits before tenant resolution and rate limiting,
	// so a request with no Authorization header must get 401 (not 400 or 429).
	resp, err := http.Get(ts.URL + "/api/v1/claw/capabilities")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestRouter_UnknownRoute_AuthFirst(t *testing.T) {
	ts := newRouterServer(t, nil)
	// Without auth: 401 (do not leak route existence).
	resp, err := http.Get(ts.URL + "/nope/404/path")
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)

	// With auth: 404 (route truly unknown).
	resp = authedGet(t, ts.URL+"/nope/404/path")
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}
