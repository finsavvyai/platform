package pgx

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type TransactionRepository struct {
	db *sql.DB
}

func NewTransactionRepository(db *sql.DB) *TransactionRepository {
	return &TransactionRepository{db: db}
}

func (r *TransactionRepository) Create(
	ctx context.Context, txn domain.Transaction,
) error {
	if txn.ID == "" {
		txn.ID = fmt.Sprintf("txn_%d", time.Now().UnixNano())
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO transactions
		(id, tenant_id, entity_id, counterparty_id,
		 amount_cents, currency, direction, country, reference)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		txn.ID, txn.TenantID.String(), txn.EntityID,
		txn.CounterpartyID, txn.AmountCents, txn.Currency,
		txn.Direction, txn.Country, txn.Reference)
	return err
}

func (r *TransactionRepository) ListByEntity(
	ctx context.Context, entityID string, limit int,
) ([]domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, entity_id, counterparty_id,
		       amount_cents, currency, direction, country, reference, created_at
		FROM transactions WHERE entity_id=$1
		ORDER BY created_at DESC LIMIT $2`, entityID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTxns(rows)
}

func (r *TransactionRepository) ListByTenant(
	ctx context.Context, tenantID domain.TenantID, limit int,
) ([]domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, entity_id, counterparty_id,
		       amount_cents, currency, direction, country, reference, created_at
		FROM transactions WHERE tenant_id=$1
		ORDER BY created_at DESC LIMIT $2`, tenantID.String(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTxns(rows)
}
