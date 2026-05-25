package screening

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// PopulateFingerprintsByList rebuilds fingerprints for a single list.
// Deletes existing rows for entities in that list, then regenerates
// from current entity state. Use for per-list manual refresh after
// upserts or schema changes.
func PopulateFingerprintsByList(db *sql.DB, listID string) (int, error) {
	if listID == "" {
		return 0, fmt.Errorf("list_id required")
	}
	start := time.Now()
	if _, err := db.Exec(
		`DELETE FROM search_fingerprints WHERE entity_id IN (
			SELECT id FROM entities WHERE list_id = $1)`, listID,
	); err != nil {
		return 0, fmt.Errorf("delete existing: %w", err)
	}
	rows, err := db.Query(
		`SELECT id, full_name, list_id FROM entities
		 WHERE list_id = $1 ORDER BY id`, listID,
	)
	if err != nil {
		return 0, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	total, err := processFPRows(db, rows)
	if err != nil {
		return total, err
	}
	log.Printf("Populated %d fingerprints for list %s in %d ms",
		total, listID, time.Since(start).Milliseconds())
	return total, nil
}
