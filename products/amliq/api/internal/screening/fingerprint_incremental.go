package screening

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// PopulateFingerprintsIncremental only processes entities missing fingerprints.
// Much faster for daily runs after initial population.
func PopulateFingerprintsIncremental(db *sql.DB) (int, error) {
	start := time.Now()
	total, err := streamMissingFPs(db)
	if err != nil {
		return 0, fmt.Errorf("incremental fingerprints: %w", err)
	}
	log.Printf("Incremental: %d fingerprints in %d ms",
		total, time.Since(start).Milliseconds())
	return total, nil
}

func streamMissingFPs(db *sql.DB) (int, error) {
	q := `SELECT e.id, e.full_name, e.list_id FROM entities e
		  WHERE NOT EXISTS (
		    SELECT 1 FROM search_fingerprints sf WHERE sf.entity_id = e.id
		  ) ORDER BY e.id`
	rows, err := db.Query(q)
	if err != nil {
		return 0, fmt.Errorf("query missing: %w", err)
	}
	defer rows.Close()
	return processFPRows(db, rows)
}

func processFPRows(db *sql.DB, rows *sql.Rows) (int, error) {
	var batch []Fingerprint
	total, entities := 0, 0
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
