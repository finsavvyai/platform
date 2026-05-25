package screening

import (
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SyncEntityFingerprints regenerates fingerprints for a single entity.
// Call within the same transaction as entity upsert for consistency.
func SyncEntityFingerprints(tx *sql.Tx, e domain.Entity) error {
	id := e.ID.String()

	// Delete old fingerprints
	_, err := tx.Exec(
		"DELETE FROM search_fingerprints WHERE entity_id = $1", id,
	)
	if err != nil {
		return fmt.Errorf("delete old fps: %w", err)
	}

	// Generate and insert new fingerprints
	fps := GenerateFingerprints(e)
	return insertFPsTx(tx, fps)
}

func insertFPsTx(tx *sql.Tx, fps []Fingerprint) error {
	stmt, err := tx.Prepare(
		`INSERT INTO search_fingerprints (entity_id, fp_type, fp_value)
		 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
	)
	if err != nil {
		return fmt.Errorf("prepare fp insert: %w", err)
	}
	defer stmt.Close()

	for _, fp := range fps {
		if _, err := stmt.Exec(fp.EntityID, fp.Type, fp.Value); err != nil {
			return fmt.Errorf("insert fp: %w", err)
		}
	}
	return nil
}

// DeleteEntityFingerprints removes all fingerprints for an entity.
func DeleteEntityFingerprints(tx *sql.Tx, entityID string) error {
	_, err := tx.Exec(
		"DELETE FROM search_fingerprints WHERE entity_id = $1", entityID,
	)
	return err
}
