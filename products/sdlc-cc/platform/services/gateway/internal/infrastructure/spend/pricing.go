// Postgres-backed pricing lookup with a 60s TTL cache. BEAT-PLAN S1.2.
// `model_pricing` (migration 012) stores cents per 1M tokens for
// prompt and completion separately; we pick the row with the most
// recent effective_from <= now.

package spend

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxPricing implements Pricing.
type PgxPricing struct {
	pool *pgxpool.Pool
	ttl  time.Duration

	mu    sync.RWMutex
	cache map[string]priceEntry
	now   func() time.Time
}

type priceEntry struct {
	promptPer1M, completionPer1M int64
	expires                      time.Time
}

// NewPgxPricing returns a pricing client. ttl<=0 applies the 60s default.
func NewPgxPricing(pool *pgxpool.Pool, ttl time.Duration) *PgxPricing {
	if pool == nil {
		panic("spend pricing: pool required")
	}
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	return &PgxPricing{
		pool:  pool,
		ttl:   ttl,
		cache: map[string]priceEntry{},
		now:   time.Now,
	}
}

// CostCents returns the USD-cent cost of the given token mix. Cache
// miss queries `model_pricing` for the active row; missing rows yield
// ErrNoPricing so callers can decide to drop / fail-open.
func (p *PgxPricing) CostCents(ctx context.Context, provider, model string, prompt, completion int) (int64, error) {
	key := provider + "|" + model
	p.mu.RLock()
	if e, ok := p.cache[key]; ok && p.now().Before(e.expires) {
		p.mu.RUnlock()
		return computeCents(e.promptPer1M, e.completionPer1M, prompt, completion), nil
	}
	p.mu.RUnlock()

	var promptCents, completionCents int64
	err := p.pool.QueryRow(ctx, `
SELECT prompt_per_1m, completion_per_1m
FROM   model_pricing
WHERE  provider = $1 AND model = $2 AND effective_from <= NOW()
ORDER BY effective_from DESC
LIMIT 1`, provider, model).Scan(&promptCents, &completionCents)
	if err != nil {
		return 0, fmt.Errorf("pricing lookup %s/%s: %w", provider, model, err)
	}

	p.mu.Lock()
	p.cache[key] = priceEntry{promptCents, completionCents, p.now().Add(p.ttl)}
	p.mu.Unlock()
	return computeCents(promptCents, completionCents, prompt, completion), nil
}

// computeCents rounds up so we never under-charge a fractional cost.
func computeCents(promptPer1M, completionPer1M int64, prompt, completion int) int64 {
	const denom = 1_000_000
	c := (int64(prompt)*promptPer1M + int64(completion)*completionPer1M)
	if c%denom != 0 {
		return c/denom + 1
	}
	return c / denom
}
