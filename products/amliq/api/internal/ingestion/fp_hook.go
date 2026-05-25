package ingestion

import (
	"database/sql"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

// FingerprintHook generates search fingerprints after entity upserts.
type FingerprintHook struct {
	db *sql.DB
}

// NewFingerprintHook creates a hook that syncs fingerprints on entity changes.
func NewFingerprintHook(db *sql.DB) *FingerprintHook {
	return &FingerprintHook{db: db}
}

// AfterUpsert generates fingerprints for newly added/modified entities.
func (h *FingerprintHook) AfterUpsert(entities []domain.Entity) {
	if len(entities) == 0 {
		return
	}
	var fps []screening.Fingerprint
	for _, e := range entities {
		fps = append(fps, screening.GenerateFingerprints(e)...)
	}
	if err := screening.BulkInsertFPsDB(h.db, fps); err != nil {
		log.Printf("WARN fingerprint hook: %v", err)
	}
}

// AfterDelete removes fingerprints for deleted entities.
func (h *FingerprintHook) AfterDelete(entities []domain.Entity) {
	for _, e := range entities {
		id := e.ID.String()
		_, err := h.db.Exec(
			"DELETE FROM search_fingerprints WHERE entity_id = $1", id,
		)
		if err != nil {
			log.Printf("WARN fingerprint delete %s: %v", id, err)
		}
	}
}
