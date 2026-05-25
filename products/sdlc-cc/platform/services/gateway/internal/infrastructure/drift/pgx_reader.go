// Postgres-backed CountReader for the D4 drift detector. Two
// queries: ActiveTenants enumerates every tenant with at least one
// audit_logs row (small set; cached in practice), and HourlyCounts
// returns the 168 hourly buckets ending at the requested wall
// clock plus the latest count.
package drift

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxReader satisfies CountReader.
type PgxReader struct {
	pool *pgxpool.Pool
}

// NewPgxReader wires the reader. Pool is required.
func NewPgxReader(pool *pgxpool.Pool) *PgxReader {
	if pool == nil {
		panic("drift: pgxpool required")
	}
	return &PgxReader{pool: pool}
}

// ActiveTenants returns every tenant with a DLP detection in the
// last 8 days. Eight rather than seven so the rolling baseline has
// at least one full window of data when an evaluation runs.
func (r *PgxReader) ActiveTenants(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT DISTINCT tenant_id
		   FROM audit_logs
		  WHERE action LIKE 'dlp.%'
		    AND created_at >= NOW() - INTERVAL '8 days'`)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	defer rows.Close()
	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return out, err
		}
		out = append(out, id)
	}
	return out, nil
}

// HourlyCounts returns the 168 hourly DLP-detection counts for
// `tenantID` ending at the truncated `end` hour. Window is right-
// inclusive of `end`, so window[len-1] is the latest bucket.
func (r *PgxReader) HourlyCounts(ctx context.Context, tenantID uuid.UUID, end time.Time) (HourlyCounts, error) {
	end = end.UTC().Truncate(time.Hour)
	start := end.Add(-167 * time.Hour) // 168 buckets total

	rows, err := r.pool.Query(ctx,
		`SELECT date_trunc('hour', created_at) AS bucket, COUNT(*)
		   FROM audit_logs
		  WHERE tenant_id = $1
		    AND action LIKE 'dlp.%'
		    AND created_at >= $2
		    AND created_at < $3
		  GROUP BY bucket`,
		tenantID, start, end.Add(time.Hour),
	)
	if err != nil {
		return HourlyCounts{}, err
	}
	defer rows.Close()

	byBucket := make(map[time.Time]int, 168)
	for rows.Next() {
		var bucket time.Time
		var n int
		if err := rows.Scan(&bucket, &n); err != nil {
			return HourlyCounts{}, err
		}
		byBucket[bucket.UTC()] = n
	}
	window := make([]int, 168)
	cur := start
	for i := 0; i < 168; i++ {
		window[i] = byBucket[cur]
		cur = cur.Add(time.Hour)
	}
	return HourlyCounts{
		Latest: window[167],
		Window: window,
		EndAt:  end,
	}, nil
}
