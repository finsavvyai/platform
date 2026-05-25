package tenant

import (
	"context"
	"fmt"
	"log"
	"net/netip"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PgLoader periodically reloads tenant_network_map rows from Postgres
// into an in-process NetworkMap. The hot lookup path (per /v1/messages
// request) goes through ResolveByIP which is lock-free; only refresh
// touches the atomic.Pointer that swaps maps.
//
// Refresh cadence is intentionally slow (default 60s). The map only
// changes on tenant onboarding or CIDR re-issue — both rare events.
// A stale-by-up-to-a-minute resolution is fine for billing/audit and
// keeps DB load near zero.
type PgLoader struct {
	pool    *pgxpool.Pool
	current atomic.Pointer[NetworkMap]
}

// NewPgLoader builds a loader and runs the first load synchronously
// so callers see a populated map (or a clear error) before serving
// requests. The returned loader is a Resolver — handlers store it
// and ResolveByIP reads through to the current snapshot.
func NewPgLoader(ctx context.Context, pool *pgxpool.Pool) (*PgLoader, error) {
	l := &PgLoader{pool: pool}
	if err := l.refresh(ctx); err != nil {
		return nil, err
	}
	return l, nil
}

// ResolveByIP delegates to the current snapshot. Empty when the table
// is empty (legitimate: no transparent-proxy customers onboarded yet)
// — handlers treat that the same as "no JWT", i.e. unattributed.
func (l *PgLoader) ResolveByIP(ip netip.Addr) string {
	snap := l.current.Load()
	if snap == nil {
		return ""
	}
	return snap.ResolveByIP(ip)
}

// Start launches a refresh goroutine that ticks every `every`. Stops
// when ctx cancels. Errors are logged + swallowed — a transient DB
// blip can't be allowed to drop the gateway off the network.
func (l *PgLoader) Start(ctx context.Context, every time.Duration) {
	if every <= 0 {
		every = 60 * time.Second
	}
	go func() {
		t := time.NewTicker(every)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				if err := l.refresh(ctx); err != nil {
					log.Printf("pg_loader: refresh failed (keeping previous snapshot): %v", err)
				}
			}
		}
	}()
}

// refresh executes the SELECT and atomically swaps the snapshot. On
// query error the previous snapshot stays live so a transient outage
// is invisible to callers.
func (l *PgLoader) refresh(ctx context.Context) error {
	rows, err := l.pool.Query(ctx, `
		SELECT cidr::text, tenant_id FROM tenant_network_map
	`)
	if err != nil {
		return fmt.Errorf("query tenant_network_map: %w", err)
	}
	defer rows.Close()

	out := make([]Row, 0, 64)
	for rows.Next() {
		var r Row
		if err := rows.Scan(&r.CIDR, &r.TenantID); err != nil {
			return fmt.Errorf("scan tenant_network_map: %w", err)
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	l.current.Store(NewNetworkMap(out))
	return nil
}

// Snapshot returns the current live map for inspection / tests.
func (l *PgLoader) Snapshot() *NetworkMap {
	return l.current.Load()
}
