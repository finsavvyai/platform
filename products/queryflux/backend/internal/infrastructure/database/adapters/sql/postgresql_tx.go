package sql

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/jackc/pgx/v5"
)

// PgTransaction wraps a pgx.Tx so it satisfies types.Transaction (Commit /
// Rollback only — extended methods land via the contract in later phases).
type PgTransaction struct {
	tx pgx.Tx
}

// Commit commits the underlying pgx transaction.
func (t *PgTransaction) Commit() error {
	return t.tx.Commit(context.Background())
}

// Rollback rolls the underlying pgx transaction back.
func (t *PgTransaction) Rollback() error {
	return t.tx.Rollback(context.Background())
}

// BeginTransaction starts a new pgx transaction on a connection drawn from
// the pool. The returned types.Transaction owns the underlying pgx.Tx.
func (p *PostgreSQLAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.pool == nil {
		return nil, notConnectedError()
	}
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, pgAdapterError("BEGIN_TX_FAILED",
			"Failed to begin transaction", ctx, err)
	}
	return &PgTransaction{tx: tx}, nil
}
