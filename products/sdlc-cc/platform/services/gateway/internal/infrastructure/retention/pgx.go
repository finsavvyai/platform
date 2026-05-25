// Postgres-backed Policies + Purger for the retention.Sweeper.
// BEAT-PLAN Day 33.
//
// Policies() reads every retention_policies row across tenants — the
// daily cron fans out to one Purge call per (tenant, data_type).
// Purger maps each data_type to the table whose rows expire.
package retention

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/retention"
)

// PgxPolicies returns a func that satisfies retention.Sweeper's
// policiesFn signature. Reads every retention_policies row.
func PgxPolicies(pool *pgxpool.Pool) func(context.Context) ([]retention.Policy, error) {
	if pool == nil {
		panic("retention: pgxpool required")
	}
	return func(ctx context.Context) ([]retention.Policy, error) {
		rows, err := pool.Query(ctx,
			`SELECT tenant_id, data_type, days, hold_until FROM retention_policies`,
		)
		if err != nil {
			return nil, fmt.Errorf("retention: policies: %w", err)
		}
		defer rows.Close()
		var out []retention.Policy
		for rows.Next() {
			var p retention.Policy
			if err := rows.Scan(&p.TenantID, &p.DataType, &p.Days, &p.HoldUntil); err != nil {
				return nil, fmt.Errorf("retention: policy scan: %w", err)
			}
			out = append(out, p)
		}
		return out, nil
	}
}

// PgxPurger satisfies retention.Purger by mapping each known
// data_type to its backing table and issuing a DELETE.
type PgxPurger struct {
	pool *pgxpool.Pool
}

// NewPgxPurger wires the purger.
func NewPgxPurger(pool *pgxpool.Pool) *PgxPurger {
	if pool == nil {
		panic("retention: pgxpool required")
	}
	return &PgxPurger{pool: pool}
}

// PurgeBefore deletes rows older than `before` for the (tenant,
// dataType) cohort. audit_logs purges respect both this purger AND
// the row-level immutability migration — DELETE is permitted only
// because retention is a privileged maintenance role; runtime app
// roles still cannot mutate audit_logs.
func (p *PgxPurger) PurgeBefore(ctx context.Context, tenantID uuid.UUID, dataType string, before time.Time) (int, error) {
	table, ok := tableFor(dataType)
	if !ok {
		return 0, fmt.Errorf("retention: unknown data_type %q", dataType)
	}
	tag, err := p.pool.Exec(ctx,
		fmt.Sprintf(`DELETE FROM %s WHERE tenant_id = $1 AND created_at < $2`, table),
		tenantID, before,
	)
	if err != nil {
		return 0, fmt.Errorf("retention: purge %s: %w", table, err)
	}
	return int(tag.RowsAffected()), nil
}

// tableFor maps the retention_policies.data_type CHECK constraint
// values to actual table names. Stays in sync with the
// retention_status reader's retentionTableFor in
// internal/infrastructure/compliance/readers.go.
func tableFor(dataType string) (string, bool) {
	switch dataType {
	case "audit_logs":
		return "audit_logs", true
	case "documents":
		return "documents", true
	case "embeddings":
		return "embeddings", true
	case "spend_events":
		return "spend_events", true
	case "chat_history":
		return "chat_messages", true
	}
	return "", false
}

// RunDailySweep starts a goroutine that runs Sweeper.Sweep on a
// daily tick (24h) until ctx is cancelled. Reports rows purged via
// the supplied logger callback. Survives transient sweep errors.
func RunDailySweep(ctx context.Context, sweeper *retention.Sweeper, log func(msg string, err error, purged int)) {
	if sweeper == nil {
		return
	}
	go func() {
		// Run once at startup so the first sweep doesn't wait 24h.
		if n, err := sweeper.Sweep(ctx); err != nil {
			log("retention sweep failed", err, n)
		} else {
			log("retention sweep ok", nil, n)
		}
		t := time.NewTicker(24 * time.Hour)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				n, err := sweeper.Sweep(ctx)
				if err != nil {
					log("retention sweep failed", err, n)
					continue
				}
				log("retention sweep ok", nil, n)
			}
		}
	}()
}

// Wire constructs the Sweeper + starts the daily ticker in one call.
// Returned Sweeper is exposed for /admin endpoints that may want to
// trigger an on-demand sweep.
func Wire(ctx context.Context, pool *pgxpool.Pool, log func(string, error, int)) (*retention.Sweeper, error) {
	if pool == nil {
		return nil, errors.New("retention: pgxpool required")
	}
	sweeper := retention.NewSweeper(PgxPolicies(pool), NewPgxPurger(pool))
	RunDailySweep(ctx, sweeper, log)
	return sweeper, nil
}
