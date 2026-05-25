package pgx

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// DeleteCryptoBySource removes all wallets for a specific source.
func (r *CryptoRepo) DeleteCryptoBySource(
	ctx context.Context, sourceID string,
) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM crypto_wallets WHERE list_id = $1", sourceID)
	if err != nil {
		return fmt.Errorf("delete crypto source %s: %w", sourceID, err)
	}
	return nil
}

// ListCryptoEntries returns all stored crypto wallet entries.
func (r *CryptoRepo) ListCryptoEntries(
	ctx context.Context,
) ([]domain.CryptoEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT address, chain, entity_id, list_id, source
		 FROM crypto_wallets ORDER BY synced_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list crypto: %w", err)
	}
	defer rows.Close()

	var entries []domain.CryptoEntry
	for rows.Next() {
		var e domain.CryptoEntry
		if err := rows.Scan(
			&e.Address, &e.Chain, &e.EntityID,
			&e.ListID, &e.Source,
		); err != nil {
			return nil, fmt.Errorf("scan crypto: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// CountByChain returns wallet counts grouped by blockchain.
func (r *CryptoRepo) CountByChain(
	ctx context.Context,
) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT chain, COUNT(*) FROM crypto_wallets GROUP BY chain`)
	if err != nil {
		return nil, fmt.Errorf("count by chain: %w", err)
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var chain string
		var count int
		if err := rows.Scan(&chain, &count); err != nil {
			return nil, err
		}
		counts[chain] = count
	}
	return counts, rows.Err()
}
