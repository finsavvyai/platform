package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

// erroringUsageRepo lets tests force CheckFreeTier to fail.
type erroringUsageRepo struct{}

func (erroringUsageRepo) GetOrCreate(
	_ context.Context, _ domain.TenantID,
	_ domain.Product, _ string,
) (*domain.UsageRecord, error) {
	return nil, errors.New("simulated DB outage")
}

func (erroringUsageRepo) IncrementMetric(
	_ context.Context, _ domain.TenantID,
	_ domain.Product, _ string,
	_ domain.UsageMetric, _ int64,
) error {
	return errors.New("simulated DB outage")
}

func (erroringUsageRepo) GetHistory(
	_ context.Context, _ domain.TenantID,
	_ domain.Product, _ int,
) ([]domain.UsageRecord, error) {
	return nil, errors.New("simulated DB outage")
}

// TestUsageCheckUnavailableFailsClosed reproduces the abuse vector
// flagged on May 8: when CheckFreeTier errors, the previous
// middleware fell back to a per-process tracker that reset on
// restart, letting a free user spam screening calls. The middleware
// must fail closed instead so the surface stays bounded by the DB
// counter even during transient repo failures.
func TestUsageCheckUnavailableFailsClosed(t *testing.T) {
	withFreshIPLimiter(t, 100)
	enforcer := billing.NewEnforcer(noSubRepo{}, erroringUsageRepo{})
	mw := UsageEnforcementMiddleware(enforcer)
	called := false
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/screen", nil)
	req = req.WithContext(ContextWithClaims(req.Context(),
		&Claims{TenantID: "tnt_000000000001", UserID: "u", Role: "admin"}))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d, want 503", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "USAGE_CHECK_UNAVAILABLE") {
		t.Errorf("body missing USAGE_CHECK_UNAVAILABLE: %s", rr.Body.String())
	}
	if called {
		t.Error("inner handler must not be invoked when usage check fails")
	}
}
