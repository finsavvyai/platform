package screening

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

const populateBatchSize = 50000

// PopulateFingerprints streams all entities and bulk-inserts fingerprints.
func PopulateFingerprints(db *sql.DB) (int, error) {
	start := time.Now()
	total, err := streamAndInsertFPs(db)
	if err != nil {
		return 0, fmt.Errorf("populate fingerprints: %w", err)
	}
	log.Printf("Populated %d fingerprints in %d ms",
		total, time.Since(start).Milliseconds())
	return total, nil
}

func streamAndInsertFPs(db *sql.DB) (int, error) {
	rows, err := db.Query(
		"SELECT id, full_name, list_id FROM entities ORDER BY id",
	)
	if err != nil {
		return 0, fmt.Errorf("query entities: %w", err)
	}
	defer rows.Close()

	var batch []Fingerprint
	total := 0
	entities := 0

	for rows.Next() {
		var id, fullName, listID string
		if err := rows.Scan(&id, &fullName, &listID); err != nil {
			return total, fmt.Errorf("scan: %w", err)
		}
		eid, _ := domain.NewEntityID(id)
		n, _ := domain.NewName(fullName, "", "", "")
		e := domain.Entity{ID: eid, Names: []domain.Name{n}, ListID: listID}
		batch = append(batch, GenerateFingerprints(e)...)
		entities++

		if len(batch) >= populateBatchSize {
			if err := bulkInsertFPs(db, batch); err != nil {
				return total, err
			}
			total += len(batch)
			log.Printf("  → %d entities, %d fingerprints...", entities, total)
			batch = batch[:0]
		}
	}
	if err := rows.Err(); err != nil {
		return total, fmt.Errorf("rows: %w", err)
	}
	if len(batch) > 0 {
		if err := bulkInsertFPs(db, batch); err != nil {
			return total, err
		}
		total += len(batch)
	}
	return total, nil
}
