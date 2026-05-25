// Postgres Sink for spend events. BEAT-PLAN S1.2 / INTEGRATION-DEBT
// Day 28: gives the existing tracker.go a real persistence target so
// every LLM call lands in spend_events.

package spend

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxSink implements Sink against the spend_events table from
// migration 012. Pool must outlive the Sink (caller-managed).
type PgxSink struct {
	pool *pgxpool.Pool
}

// NewPgxSink constructs the sink.
func NewPgxSink(pool *pgxpool.Pool) *PgxSink {
	if pool == nil {
		panic("spend sink: pool required")
	}
	return &PgxSink{pool: pool}
}

// Write inserts one event with the cost the tracker computed.
func (s *PgxSink) Write(ctx context.Context, ev Event, usdCents int64) error {
	const stmt = `
INSERT INTO spend_events
    (tenant_id, user_id, api_key_id, provider, model,
     prompt_tokens, completion_tokens, usd_cents, request_id, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err := s.pool.Exec(ctx, stmt,
		ev.TenantID, ev.UserID, ev.APIKeyID, ev.Provider, ev.Model,
		ev.PromptTokens, ev.CompletionTokens, usdCents, ev.RequestID, ev.OccurredAt)
	if err != nil {
		return fmt.Errorf("spend sink: insert: %w", err)
	}
	return nil
}
