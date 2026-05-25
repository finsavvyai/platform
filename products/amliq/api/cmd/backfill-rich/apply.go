package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// applyBackfill creates a session-scoped temp table, inserts `rows` in
// chunks of `batch`, then runs one UPDATE...FROM to copy the three
// rich JSONB columns onto entities where tenant_id='__global__'.
func applyBackfill(
	ctx context.Context, db *sql.DB, rows []richRow, batch int,
) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		CREATE TEMP TABLE _rich_bf (
			id          TEXT PRIMARY KEY,
			addresses   JSONB,
			identifiers JSONB,
			aliases     JSONB
		) ON COMMIT DROP`)
	if err != nil {
		return fmt.Errorf("create temp: %w", err)
	}
	if err := insertBatches(ctx, tx, rows, batch); err != nil {
		return err
	}

	log.Printf("  running UPDATE...FROM on entities")
	res, err := tx.ExecContext(ctx, `
		UPDATE entities e SET
			addresses   = COALESCE(r.addresses,   e.addresses),
			identifiers = COALESCE(r.identifiers, e.identifiers),
			aliases     = COALESCE(r.aliases,     e.aliases)
		FROM _rich_bf r
		WHERE e.id = r.id
		  AND e.tenant_id = $1`, domain.SystemTenantID())
	if err != nil {
		return fmt.Errorf("update entities: %w", err)
	}
	n, _ := res.RowsAffected()
	log.Printf("  updated %d rows", n)
	return tx.Commit()
}

func insertBatches(
	ctx context.Context, tx *sql.Tx, rows []richRow, batch int,
) error {
	if batch <= 0 {
		batch = 8000
	}
	for i := 0; i < len(rows); i += batch {
		end := i + batch
		if end > len(rows) {
			end = len(rows)
		}
		if err := insertChunk(ctx, tx, rows[i:end]); err != nil {
			return err
		}
		log.Printf("  staged %d/%d (%d%%)",
			end, len(rows), (end*100)/len(rows))
	}
	return nil
}

func insertChunk(
	ctx context.Context, tx *sql.Tx, rows []richRow,
) error {
	placeholders := make([]string, len(rows))
	args := make([]interface{}, 0, len(rows)*4)
	for i, r := range rows {
		base := i * 4
		placeholders[i] = fmt.Sprintf("($%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4)
		args = append(args, r.id, r.addrs, r.ids, r.alts)
	}
	q := `INSERT INTO _rich_bf (id,addresses,identifiers,aliases) VALUES ` +
		strings.Join(placeholders, ",") +
		` ON CONFLICT (id) DO UPDATE SET
			addresses   = EXCLUDED.addresses,
			identifiers = EXCLUDED.identifiers,
			aliases     = EXCLUDED.aliases`
	_, err := tx.ExecContext(ctx, q, args...)
	return err
}
