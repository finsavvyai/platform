// Postgres-backed analytics stores for the Day-30 admin dashboard.
//
// Reads spend_events directly (the materialized views from migration
// 014 are nice-to-have but not required for correctness — refresh
// cadence becomes relevant once the table grows past a few million
// rows). Tenant id is pulled from request context via the chain's
// CtxKeyTenantID so cross-tenant leakage is impossible at the SQL
// layer (the WHERE tenant_id = $1 is required, not optional).
package analytics

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	apphandlers "github.com/sdlc-ai/platform/services/gateway/internal/app/handlers"
)

// PgxStore satisfies both AnalyticsOverviewStore and TimeseriesStore.
type PgxStore struct {
	pool      *pgxpool.Pool
	tenantCtx func(context.Context) (uuid.UUID, bool)
}

// NewPgxStore wires the store. tenantCtx pulls the tenant id from
// the request context (the chain populates CtxKeyTenantID; the
// caller adapts that to a uuid).
func NewPgxStore(pool *pgxpool.Pool, tenantCtx func(context.Context) (uuid.UUID, bool)) *PgxStore {
	if pool == nil || tenantCtx == nil {
		panic("analytics: pool + tenantCtx required")
	}
	return &PgxStore{pool: pool, tenantCtx: tenantCtx}
}

// Overview implements apphandlers.AnalyticsOverviewStore.
func (s *PgxStore) Overview(ctx context.Context, q apphandlers.AnalyticsRange) (apphandlers.AnalyticsOverview, error) {
	out := apphandlers.AnalyticsOverview{From: q.From, To: q.To}
	tenantID, ok := s.tenantCtx(ctx)
	if !ok {
		return out, errors.New("analytics: no tenant in context")
	}

	// Aggregate totals.
	if err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(COUNT(*),0),
		       COALESCE(SUM(prompt_tokens + completion_tokens),0)::bigint,
		       COALESCE(SUM(usd_cents),0)::bigint
		  FROM spend_events
		 WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3`,
		tenantID, q.From, q.To,
	).Scan(&out.TotalQueries, &out.TotalTokens, &out.TotalUSDCents); err != nil {
		return out, fmt.Errorf("analytics: totals: %w", err)
	}

	// Top models.
	rows, err := s.pool.Query(ctx, `
		SELECT provider, model, COUNT(*),
		       SUM(prompt_tokens + completion_tokens)::bigint,
		       SUM(usd_cents)::bigint
		  FROM spend_events
		 WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3
		 GROUP BY provider, model
		 ORDER BY 5 DESC
		 LIMIT 5`,
		tenantID, q.From, q.To,
	)
	if err != nil {
		return out, fmt.Errorf("analytics: top models: %w", err)
	}
	for rows.Next() {
		var m apphandlers.ModelTotal
		if err := rows.Scan(&m.Provider, &m.Model, &m.Queries, &m.Tokens, &m.USDCents); err != nil {
			rows.Close()
			return out, fmt.Errorf("analytics: top models scan: %w", err)
		}
		out.TopModels = append(out.TopModels, m)
	}
	rows.Close()

	// Top users (excludes user_id IS NULL — system / api-key calls).
	urows, err := s.pool.Query(ctx, `
		SELECT user_id::text, COUNT(*),
		       SUM(prompt_tokens + completion_tokens)::bigint,
		       SUM(usd_cents)::bigint
		  FROM spend_events
		 WHERE tenant_id = $1 AND user_id IS NOT NULL
		   AND created_at >= $2 AND created_at < $3
		 GROUP BY user_id
		 ORDER BY 4 DESC
		 LIMIT 5`,
		tenantID, q.From, q.To,
	)
	if err != nil {
		return out, fmt.Errorf("analytics: top users: %w", err)
	}
	defer urows.Close()
	for urows.Next() {
		var u apphandlers.UserTotal
		if err := urows.Scan(&u.UserID, &u.Queries, &u.Tokens, &u.USDCents); err != nil {
			return out, fmt.Errorf("analytics: top users scan: %w", err)
		}
		out.TopUsers = append(out.TopUsers, u)
	}
	return out, nil
}

// Timeseries implements apphandlers.TimeseriesStore. Granularity
// "hour" uses date_trunc('hour'); "day" uses date_trunc('day').
// Metrics map to spend_events columns.
func (s *PgxStore) Timeseries(ctx context.Context, q apphandlers.TimeseriesQuery) (apphandlers.TimeseriesResult, error) {
	out := apphandlers.TimeseriesResult{}
	tenantID, ok := s.tenantCtx(ctx)
	if !ok {
		return out, errors.New("analytics: no tenant in context")
	}
	bucket := "day"
	if q.Granularity == "hour" {
		bucket = "hour"
	}
	value := metricExpr(q.Metric)
	stmt := fmt.Sprintf(`
		SELECT date_trunc('%s', created_at) AS b, %s
		  FROM spend_events
		 WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3
		 GROUP BY b
		 ORDER BY b`,
		bucket, value)
	rows, err := s.pool.Query(ctx, stmt, tenantID, q.From, q.To)
	if err != nil {
		return out, fmt.Errorf("analytics: timeseries: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var p apphandlers.TimeseriesPoint
		var bucketStart time.Time
		var v float64
		if err := rows.Scan(&bucketStart, &v); err != nil {
			return out, fmt.Errorf("analytics: timeseries scan: %w", err)
		}
		p.BucketStart = bucketStart
		p.Value = v
		out.Buckets = append(out.Buckets, p)
	}
	return out, nil
}

// metricExpr maps the validated metric name to a SQL aggregate.
// Stays in lockstep with handlers/analytics_timeseries.go validMetric.
func metricExpr(metric string) string {
	switch metric {
	case "queries":
		return "COUNT(*)::float8"
	case "tokens":
		return "COALESCE(SUM(prompt_tokens + completion_tokens),0)::float8"
	case "usd_cents":
		return "COALESCE(SUM(usd_cents),0)::float8"
	case "latency_ms":
		return "COALESCE(AVG(latency_ms),0)::float8"
	}
	return "0::float8"
}
