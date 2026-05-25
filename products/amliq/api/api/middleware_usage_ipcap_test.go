package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/billing"
)

// withFreshIPLimiter swaps the package-level IP limiter with a small
// test instance and restores it on cleanup. Required because the
// real limiter is a process-wide singleton and tests would otherwise
// share its counter map across the whole package run.
func withFreshIPLimiter(t *testing.T, limit int) {
	t.Helper()
	saved := ipDailyScreenLimiter
	ipDailyScreenLimiter = NewIPRateLimiter(limit, time.Hour)
	t.Cleanup(func() { ipDailyScreenLimiter = saved })
}

// TestIPDailyCapBlocksMultiAccountFarming covers the second abuse
// vector flagged on May 8: a single human registers N tenants and
// gets N*FreeTierScreeningsPerDay daily screens. The per-IP daily
// backstop bounds the human-level surface independent of tenant
// count — even with fresh tenants every call, the IP counter caps.
func TestIPDailyCapBlocksMultiAccountFarming(t *testing.T) {
	withFreshIPLimiter(t, 3)
	usage := &memUsageRepo{}
	enforcer := billing.NewEnforcer(noSubRepo{}, usage)
	mw := UsageEnforcementMiddleware(enforcer)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 1; i <= 3; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/screen", nil)
		// Fresh tenant each time = simulates farming across accounts.
		req = req.WithContext(ContextWithClaims(req.Context(),
			&Claims{TenantID: "tnt_00000000000" + string(rune('0'+i)),
				UserID: "u", Role: "admin"}))
		req.RemoteAddr = "203.0.113.10:55555"
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("request %d: got %d body=%s", i, rr.Code, rr.Body.String())
		}
	}
	// 4th call from same IP must be 429 even though it belongs to a
	// fresh tenant with full free-tier headroom.
	req := httptest.NewRequest(http.MethodPost, "/api/v1/screen", nil)
	req = req.WithContext(ContextWithClaims(req.Context(),
		&Claims{TenantID: "tnt_000000000099", UserID: "u", Role: "admin"}))
	req.RemoteAddr = "203.0.113.10:55555"
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("4th: status=%d, want 429", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "IP_DAILY_LIMIT") {
		t.Errorf("body missing IP_DAILY_LIMIT: %s", rr.Body.String())
	}
}
