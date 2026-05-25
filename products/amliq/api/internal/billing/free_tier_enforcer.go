package billing

import (
	"context"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// FreeTierDailyScreenings is the per-tenant daily screening cap when
// no active subscription is on file. Survives process restarts because
// it is persisted via UsageRepository (DB-backed in production), unlike
// the prior in-memory tracker which reset on every redeploy.
const FreeTierDailyScreenings int64 = 10

// freeTierPeriod returns the daily period key used by free-tier
// counters (YYYY-MM-DD). Distinct from monthly billing period.
func freeTierPeriod() string {
	now := time.Now().UTC()
	return fmt.Sprintf("%04d-%02d-%02d",
		now.Year(), now.Month(), now.Day())
}

// CheckFreeTier returns whether a tenant has free-tier headroom today.
// Does not increment — call RecordFreeTier on a successful billable
// response. Limit is FreeTierDailyScreenings; remaining is signed so
// callers can detect exhausted (<= 0) vs. in-budget.
func (e *Enforcer) CheckFreeTier(
	ctx context.Context, tenantID domain.TenantID,
) (allowed bool, remaining int64, err error) {
	period := freeTierPeriod()
	rec, err := e.usage.GetOrCreate(ctx, tenantID, domain.ProductAPI, period)
	if err != nil {
		return false, 0, fmt.Errorf("free-tier usage read: %w", err)
	}
	used := rec.Metrics[domain.MetricAPIScreenings]
	remaining = FreeTierDailyScreenings - used
	return remaining > 0, remaining, nil
}

// RecordFreeTier increments today's free-tier counter for a tenant.
// Called after the billable handler returned 2xx so unsuccessful
// requests do not count against the daily cap.
func (e *Enforcer) RecordFreeTier(
	ctx context.Context, tenantID domain.TenantID,
) error {
	return e.usage.IncrementMetric(
		ctx, tenantID,
		domain.ProductAPI, freeTierPeriod(),
		domain.MetricAPIScreenings, 1,
	)
}
