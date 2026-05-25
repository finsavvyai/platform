// Spend usage + limit lookup against migration 012's spend_events +
// spend_limits tables. Used by the /v1/chat 402 hard-cap gate.
//
// BEAT-PLAN S1.2 / INTEGRATION-DEBT Days 28-29.

package spend

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	domspend "github.com/sdlc-ai/platform/services/gateway/internal/domain/spend"
)

// UsageReader exposes month-to-date spend per scope.
type UsageReader struct {
	pool *pgxpool.Pool
	now  func() time.Time
}

// NewUsageReader returns a usage reader.
func NewUsageReader(pool *pgxpool.Pool) *UsageReader {
	if pool == nil {
		panic("spend usage: pool required")
	}
	return &UsageReader{pool: pool, now: time.Now}
}

// MonthToDateCents returns the sum of usd_cents in spend_events for
// the tenant since UTC start of the current month. Zero when no rows
// exist; never returns ErrNoRows.
func (u *UsageReader) MonthToDateCents(ctx context.Context, tenantID uuid.UUID) (int64, error) {
	startOfMonth := monthStart(u.now())
	var cents int64
	err := u.pool.QueryRow(ctx, `
SELECT COALESCE(SUM(usd_cents), 0)
FROM   spend_events
WHERE  tenant_id = $1 AND created_at >= $2`,
		tenantID, startOfMonth).Scan(&cents)
	if err != nil {
		return 0, fmt.Errorf("usage query: %w", err)
	}
	return cents, nil
}

// LimitRepo loads spend_limits rows. Missing row -> ErrNoLimit so the
// caller can fail-open or apply a default.
type LimitRepo struct {
	pool *pgxpool.Pool
}

// NewLimitRepo wires the limit repo.
func NewLimitRepo(pool *pgxpool.Pool) *LimitRepo {
	if pool == nil {
		panic("spend limits: pool required")
	}
	return &LimitRepo{pool: pool}
}

// ErrNoLimit signals "no row in spend_limits for this scope".
var ErrNoLimit = errors.New("spend: no limit configured")

// ForTenant returns the active LimitConfig for the tenant. Returns
// ErrNoLimit when the tenant has no row in spend_limits.
func (r *LimitRepo) ForTenant(ctx context.Context, tenantID uuid.UUID) (domspend.LimitConfig, error) {
	var cfg domspend.LimitConfig
	cfg.Scope = "tenant"
	cfg.ScopeID = tenantID
	err := r.pool.QueryRow(ctx, `
SELECT monthly_usd_cents, soft_cap_pct, hard_cap_pct
FROM   spend_limits
WHERE  scope = 'tenant' AND scope_id = $1`,
		tenantID).Scan(&cfg.MonthlyUSDCents, &cfg.SoftCapPct, &cfg.HardCapPct)
	if errors.Is(err, pgx.ErrNoRows) {
		return cfg, ErrNoLimit
	}
	if err != nil {
		return cfg, fmt.Errorf("limit lookup: %w", err)
	}
	return cfg, nil
}

func monthStart(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}
