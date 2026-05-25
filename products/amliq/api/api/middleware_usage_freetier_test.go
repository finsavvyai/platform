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

// memUsageRepo is an in-test UsageRepository sufficient for the
// free-tier counter. Goes through the real Enforcer.CheckFreeTier
// + RecordFreeTier path so the test exercises the production code,
// not a parallel implementation.
type memUsageRepo struct {
	rec domain.UsageRecord
}

func (m *memUsageRepo) GetOrCreate(
	_ context.Context, _ domain.TenantID,
	_ domain.Product, _ string,
) (*domain.UsageRecord, error) {
	if m.rec.Metrics == nil {
		m.rec.Metrics = map[domain.UsageMetric]int64{}
	}
	return &m.rec, nil
}

func (m *memUsageRepo) IncrementMetric(
	_ context.Context, _ domain.TenantID,
	_ domain.Product, _ string,
	metric domain.UsageMetric, n int64,
) error {
	if m.rec.Metrics == nil {
		m.rec.Metrics = map[domain.UsageMetric]int64{}
	}
	m.rec.Metrics[metric] += n
	return nil
}

func (m *memUsageRepo) GetHistory(
	_ context.Context, _ domain.TenantID,
	_ domain.Product, _ int,
) ([]domain.UsageRecord, error) {
	return nil, nil
}

// noSubRepo always returns "no active subscription" so the
// middleware funnels to the free-tier path.
type noSubRepo struct{}

func (noSubRepo) Create(_ context.Context, _ domain.Subscription) error {
	return nil
}
func (noSubRepo) GetByTenantID(
	_ context.Context, _ domain.TenantID,
) (*domain.Subscription, error) {
	return nil, errors.New("no subscription")
}
func (noSubRepo) GetByLemonSqueezyID(
	_ context.Context, _ string,
) (*domain.Subscription, error) {
	return nil, errors.New("no subscription")
}
func (noSubRepo) Update(_ context.Context, _ domain.Subscription) error {
	return nil
}
func (noSubRepo) ListByTenantID(
	_ context.Context, _ domain.TenantID,
) ([]domain.Subscription, error) {
	return nil, nil
}
func (noSubRepo) Delete(_ context.Context, _ string) error {
	return nil
}

func TestFreeTierBlocksAt11thRequest(t *testing.T) {
	usage := &memUsageRepo{}
	enforcer := billing.NewEnforcer(noSubRepo{}, usage)
	mw := UsageEnforcementMiddleware(enforcer)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	claims := &Claims{TenantID: "tnt_000000000001", UserID: "u", Role: "admin"}
	for i := 1; i <= int(billing.FreeTierDailyScreenings); i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/screen", nil)
		req = req.WithContext(ContextWithClaims(req.Context(), claims))
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("request %d: want 200, got %d body=%s",
				i, rr.Code, rr.Body.String())
		}
	}
	// 11th must be blocked with 402 + FREE_TIER_EXHAUSTED.
	req := httptest.NewRequest(http.MethodPost, "/api/v1/screen", nil)
	req = req.WithContext(ContextWithClaims(req.Context(), claims))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusPaymentRequired {
		t.Fatalf("11th: want 402, got %d body=%s",
			rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "FREE_TIER_EXHAUSTED") {
		t.Errorf("11th: want FREE_TIER_EXHAUSTED, got %s",
			rr.Body.String())
	}
}
