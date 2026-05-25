package audit

import (
	"context"
	"time"
)

// AIRequestLog is one row per provider call. Tokens may be nil if
// the upstream didn't return usage and our estimator didn't run.
// Cached rows have status="ok" and cost_usd_micros=0.
type AIRequestLog struct {
	ID               int64
	TenantID         string
	ActorID          string
	Provider         string
	Model            string
	SummaryType      string
	PromptTokens     *int
	CompletionTokens *int
	LatencyMs        int
	Status           string
	ErrorCode        string
	CostUSDMicros    *int64
	Cached           bool
	CreatedAt        time.Time
}

// Repository persists AI request log rows. Failures must not break
// the request path — observability is a best-effort write. Pluggable
// so consumers can wire Postgres, Redis, S3, BigQuery, etc.
//
// ListByTenant: empty tenantID means "all tenants" — admin/governance
// dashboards aggregate cross-tenant usage that way, regular tenant
// queries pass a non-empty ID and only see their own rows.
type Repository interface {
	Create(ctx context.Context, row AIRequestLog) error
	ListByTenant(ctx context.Context, tenantID string,
		since, until time.Time, limit int) ([]AIRequestLog, error)
	SumCostUSDMicros(ctx context.Context, tenantID string,
		since, until time.Time) (int64, error)
}

// InMemoryRepository is the dev-mode + test-mode store. NOT for
// production: no persistence, unbounded memory growth.
type InMemoryRepository struct {
	rows []AIRequestLog
}

func NewInMemoryRepository() *InMemoryRepository {
	return &InMemoryRepository{}
}

func (r *InMemoryRepository) Create(_ context.Context, row AIRequestLog) error {
	row.ID = int64(len(r.rows) + 1)
	row.CreatedAt = time.Now().UTC()
	r.rows = append(r.rows, row)
	return nil
}

func (r *InMemoryRepository) ListByTenant(_ context.Context, tenantID string, since, until time.Time, limit int) ([]AIRequestLog, error) {
	out := make([]AIRequestLog, 0)
	for _, row := range r.rows {
		if tenantID != "" && row.TenantID != tenantID {
			continue
		}
		if row.CreatedAt.Before(since) || row.CreatedAt.After(until) {
			continue
		}
		out = append(out, row)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (r *InMemoryRepository) SumCostUSDMicros(_ context.Context, tenantID string, since, until time.Time) (int64, error) {
	var total int64
	for _, row := range r.rows {
		if row.TenantID != tenantID {
			continue
		}
		if row.CreatedAt.Before(since) || row.CreatedAt.After(until) {
			continue
		}
		if row.CostUSDMicros != nil {
			total += *row.CostUSDMicros
		}
	}
	return total, nil
}
