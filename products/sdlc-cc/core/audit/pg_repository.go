package audit

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PgRepository is the durable Repository implementation. The
// in-memory variant suffices for dev + tests but loses every audit
// row on restart, which fails compliance review the first time
// the gateway pod restarts under load. Schema lives in the consumer
// repo (sdlc-cc/migrations/002_ai_request_log.sql); this file
// assumes the table exists.
//
// Connection lifecycle is the caller's: pgxpool.New + Close are not
// done here so the same pool can serve multiple repos in one process.
type PgRepository struct {
	pool *pgxpool.Pool
}

// NewPgRepository wraps a pgxpool.Pool. Returns the concrete type
// (not the interface) so callers can keep a typed handle for any
// Pg-specific helpers we add later.
func NewPgRepository(pool *pgxpool.Pool) *PgRepository {
	return &PgRepository{pool: pool}
}

// Create inserts one audit row. Failures bubble up; the caller
// (RecordAIRequest) logs + drops so observability never breaks the
// request path. CreatedAt is set server-side by `DEFAULT NOW()` to
// stay clock-skew-resistant across replicas.
func (r *PgRepository) Create(ctx context.Context, row AIRequestLog) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO ai_request_log
		  (tenant_id, actor_id, provider, model, summary_type,
		   prompt_tokens, completion_tokens, latency_ms, status,
		   error_code, cost_usd_micros, cached)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`, row.TenantID, row.ActorID, row.Provider, row.Model, row.SummaryType,
		row.PromptTokens, row.CompletionTokens, row.LatencyMs, row.Status,
		row.ErrorCode, row.CostUSDMicros, row.Cached)
	if err != nil {
		return fmt.Errorf("ai_request_log insert: %w", err)
	}
	return nil
}

// ListByTenant returns rows scoped to the window. Empty tenantID
// means cross-tenant — admin/governance queries set this; tenant-
// scoped callers always pass a non-empty ID. Limit is hard-capped
// at 10k so a misconfigured admin query can't OOM the gateway.
func (r *PgRepository) ListByTenant(ctx context.Context, tenantID string,
	since, until time.Time, limit int) ([]AIRequestLog, error) {

	if limit <= 0 || limit > 10_000 {
		limit = 10_000
	}

	const q = `
		SELECT id, tenant_id, actor_id, provider, model, summary_type,
		       prompt_tokens, completion_tokens, latency_ms, status,
		       error_code, cost_usd_micros, cached, created_at
		  FROM ai_request_log
		 WHERE created_at >= $1 AND created_at <= $2
		   AND ($3 = '' OR tenant_id = $3)
		 ORDER BY created_at DESC
		 LIMIT $4
	`
	rows, err := r.pool.Query(ctx, q, since, until, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("ai_request_log list: %w", err)
	}
	defer rows.Close()

	out := make([]AIRequestLog, 0)
	for rows.Next() {
		var x AIRequestLog
		if err := rows.Scan(&x.ID, &x.TenantID, &x.ActorID, &x.Provider,
			&x.Model, &x.SummaryType, &x.PromptTokens, &x.CompletionTokens,
			&x.LatencyMs, &x.Status, &x.ErrorCode, &x.CostUSDMicros,
			&x.Cached, &x.CreatedAt); err != nil {
			return nil, fmt.Errorf("ai_request_log scan: %w", err)
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// SumCostUSDMicros aggregates spend in the window. Coalesce so rows
// with NULL cost (cached / errored) contribute zero rather than NULL
// poisoning the SUM result.
func (r *PgRepository) SumCostUSDMicros(ctx context.Context, tenantID string,
	since, until time.Time) (int64, error) {

	const q = `
		SELECT COALESCE(SUM(cost_usd_micros), 0)
		  FROM ai_request_log
		 WHERE created_at >= $1 AND created_at <= $2
		   AND ($3 = '' OR tenant_id = $3)
	`
	var total int64
	if err := r.pool.QueryRow(ctx, q, since, until, tenantID).Scan(&total); err != nil {
		return 0, fmt.Errorf("ai_request_log sum: %w", err)
	}
	return total, nil
}
