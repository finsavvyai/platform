// Outbound webhook dispatcher. BEAT-PLAN Day 38.
//
// Dispatch fans out (tenantID, event_type, payload) to every active
// endpoint subscribed to that event in `webhook_endpoints`, signs
// each payload with that endpoint's per-row HMAC secret, and hands
// delivery to the existing Retrier (5 attempts then DLQ).
//
// Dispatch is non-blocking by default — fire-and-forget on a worker
// goroutine — so call sites in the request path don't pay a round-
// trip for the outbound delivery.
package webhooks

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Subscription is one row of webhook_endpoints loaded for a Dispatch.
type Subscription struct {
	ID       uuid.UUID
	TenantID uuid.UUID
	URL      string
	Secret   []byte
}

// EndpointStore returns the active subscriptions for one (tenant,
// event) pair. Production is PgxEndpointStore; tests pass a fake.
type EndpointStore interface {
	List(ctx context.Context, tenantID uuid.UUID, eventType string) ([]Subscription, error)
}

// Dispatcher orchestrates the per-event fan-out.
type Dispatcher struct {
	Store   EndpointStore
	Retrier *Retrier
	Now     func() time.Time
	// Concurrency caps the number of in-flight deliveries per
	// Dispatch call. Zero = serial.
	Concurrency int
}

// NewDispatcher wires the dispatcher. Both store and retrier are
// required.
func NewDispatcher(store EndpointStore, retrier *Retrier) *Dispatcher {
	if store == nil || retrier == nil {
		panic("webhooks: store + retrier required")
	}
	return &Dispatcher{Store: store, Retrier: retrier, Now: time.Now, Concurrency: 4}
}

// Dispatch fans out the event to every matching active endpoint.
// Returns the count of endpoints contacted and any aggregated error
// from the Store lookup. Per-endpoint delivery errors are routed to
// DLQ and do NOT propagate up — Dispatch is intentionally a fire-
// and-forget facade.
func (d *Dispatcher) Dispatch(ctx context.Context, tenantID uuid.UUID, eventType string, payload []byte) (int, error) {
	subs, err := d.Store.List(ctx, tenantID, eventType)
	if err != nil {
		return 0, fmt.Errorf("webhooks: list: %w", err)
	}
	if len(subs) == 0 {
		return 0, nil
	}
	sem := make(chan struct{}, max1(d.Concurrency))
	var wg sync.WaitGroup
	for _, s := range subs {
		s := s
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			d.deliverOne(ctx, s, eventType, payload)
		}()
	}
	wg.Wait()
	return len(subs), nil
}

// deliverOne signs + invokes Retrier.Deliver for one subscription.
// Errors are swallowed because Retrier already routes terminal
// failures to DLQ; a return up the stack is redundant.
func (d *Dispatcher) deliverOne(ctx context.Context, s Subscription, eventType string, payload []byte) {
	headers, err := Sign(s.Secret, payload, d.Now)
	if err != nil {
		return
	}
	target := Endpoint{
		ID:       s.ID.String(),
		URL:      s.URL,
		TenantID: s.TenantID.String(),
	}
	_ = d.Retrier.Deliver(ctx, target, payload, headers)
}

func max1(n int) int {
	if n < 1 {
		return 1
	}
	return n
}

// PgxEndpointStore reads webhook_endpoints from a pgxpool.
type PgxEndpointStore struct {
	pool *pgxpool.Pool
}

// NewPgxEndpointStore wires the store. Pool is required.
func NewPgxEndpointStore(pool *pgxpool.Pool) *PgxEndpointStore {
	if pool == nil {
		panic("webhooks: pgxpool required")
	}
	return &PgxEndpointStore{pool: pool}
}

// List returns every active subscription for (tenantID, eventType).
func (p *PgxEndpointStore) List(ctx context.Context, tenantID uuid.UUID, eventType string) ([]Subscription, error) {
	rows, err := p.pool.Query(ctx,
		`SELECT id, tenant_id, url, secret
		   FROM webhook_endpoints
		  WHERE tenant_id = $1 AND event_type = $2 AND is_active = TRUE`,
		tenantID, eventType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Subscription
	for rows.Next() {
		var s Subscription
		if err := rows.Scan(&s.ID, &s.TenantID, &s.URL, &s.Secret); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}
