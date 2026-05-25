package pgx

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// CryptoRepo implements ingestion.CryptoStore using PostgreSQL.
type CryptoRepo struct {
	db *sql.DB
}

// NewCryptoRepo creates a new crypto wallet repository.
func NewCryptoRepo(db *sql.DB) *CryptoRepo {
	return &CryptoRepo{db: db}
}

// UpsertCryptoEntries inserts or updates crypto wallet entries.
func (r *CryptoRepo) UpsertCryptoEntries(
	ctx context.Context, entries []domain.CryptoEntry,
) error {
	if len(entries) == 0 {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO crypto_wallets (address, chain, entity_id, list_id, source, synced_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (address, chain) DO UPDATE
		SET entity_id = EXCLUDED.entity_id,
		    list_id = EXCLUDED.list_id,
		    source = EXCLUDED.source,
		    synced_at = NOW()`)
	if err != nil {
		return fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()

	for _, e := range entries {
		_, err := stmt.ExecContext(ctx,
			e.Address, e.Chain, e.EntityID, e.ListID, e.Source)
		if err != nil {
			return fmt.Errorf("upsert %s: %w", e.Address, err)
		}
	}

	return tx.Commit()
}
