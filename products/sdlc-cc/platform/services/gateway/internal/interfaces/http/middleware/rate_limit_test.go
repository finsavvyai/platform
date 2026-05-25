package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
)

func setupMW(t *testing.T, rules []ratelimit.Rule, failClosed bool) (http.Handler, uuid.UUID) {
	t.Helper()

	tenantID := uuid.New()

	// Real Redis-compatible miniredis backs the limiter.
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	limiter := ratelimit.NewLimiter(rdb, "test:")

	// sqlmock fakes the Postgres lookup for the rules.
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	rows := sqlmock.NewRows([]string{"tenant_id", "route_pattern", "requests_per_minute", "burst"})
	for _, rule := range rules {
		rows.AddRow(rule.TenantID, rule.RoutePattern, rule.RequestsPerMinute, rule.Burst)
	}
	mock.ExpectQuery(
		"SELECT tenant_id, route_pattern, requests_per_minute, burst " +
			"FROM rate_limits WHERE tenant_id = $1",
	).WithArgs(tenantID).WillReturnRows(rows)

	repo := ratelimit.NewConfigRepo(db, 0)

	getTenant := func(ctx context.Context) (uuid.UUID, bool) {
		return tenantID, true
	}

	final := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	mw := RateLimit(RateLimitConfig{
		Limiter:    limiter,
		Repo:       repo,
		GetTenant:  getTenant,
		FailClosed: failClosed,
	})
	return mw(final), tenantID
}

func sendN(t *testing.T, handler http.Handler, n int, path string) []*httptest.ResponseRecorder {
	t.Helper()
	out := make([]*httptest.ResponseRecorder, 0, n)
	for i := 0; i < n; i++ {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		out = append(out, rr)
	}
	return out
}

func TestMW_AllowsWithinLimit(t *testing.T) {
	tenantID := uuid.New()
	handler, _ := setupMW(t, []ratelimit.Rule{
		{TenantID: tenantID, RoutePattern: "/v1/q", RequestsPerMinute: 5, Burst: 100},
	}, false)
	for _, rr := range sendN(t, handler, 3, "/v1/q") {
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rr.Code)
		}
		if rr.Header().Get("X-RateLimit-Limit") != "5" {
			t.Fatalf("X-RateLimit-Limit header missing/wrong: %q", rr.Header().Get("X-RateLimit-Limit"))
		}
	}
}

func TestMW_429AfterLimit(t *testing.T) {
	tenantID := uuid.New()
	handler, _ := setupMW(t, []ratelimit.Rule{
		{TenantID: tenantID, RoutePattern: "/v1/q", RequestsPerMinute: 2, Burst: 100},
	}, false)
	results := sendN(t, handler, 5, "/v1/q")
	codes := []int{}
	for _, rr := range results {
		codes = append(codes, rr.Code)
	}
	allowed := 0
	denied429 := 0
	for _, rr := range results {
		switch rr.Code {
		case http.StatusOK:
			allowed++
		case http.StatusTooManyRequests:
			denied429++
			if rr.Header().Get("Retry-After") == "" {
				t.Fatalf("429 must set Retry-After")
			}
		}
	}
	if allowed != 2 || denied429 != 3 {
		t.Fatalf("want 2 allowed + 3 denied, got %d/%d (codes: %v)", allowed, denied429, codes)
	}
}

func TestMW_FailOpenWhenNoRule(t *testing.T) {
	handler, _ := setupMW(t, []ratelimit.Rule{}, false /* allow on miss */)
	for _, rr := range sendN(t, handler, 5, "/v1/q") {
		if rr.Code != http.StatusOK {
			t.Fatalf("fail-open: expected 200, got %d", rr.Code)
		}
	}
}

func TestMW_FailClosedWhenNoRule(t *testing.T) {
	handler, _ := setupMW(t, []ratelimit.Rule{}, true /* deny on miss */)
	rr := sendN(t, handler, 1, "/v1/q")[0]
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("fail-closed: expected 503, got %d", rr.Code)
	}
}

func TestMW_DefaultRuleAppliesToAllRoutes(t *testing.T) {
	tenantID := uuid.New()
	handler, _ := setupMW(t, []ratelimit.Rule{
		{TenantID: tenantID, RoutePattern: "*", RequestsPerMinute: 2, Burst: 100},
	}, false)
	results := sendN(t, handler, 3, "/some/random/path")
	if results[0].Code != http.StatusOK || results[1].Code != http.StatusOK {
		t.Fatalf("first 2 must be allowed under wildcard rule")
	}
	if results[2].Code != http.StatusTooManyRequests {
		t.Fatalf("3rd must be 429 under wildcard rule")
	}
}

// dbRequired ensures a real *sql.DB pointer exists (NewConfigRepo is
// non-nil-tolerant). Keeps the import compiler-happy if we ever drop
// sqlmock.
var _ = (*sql.DB)(nil)
