package screening

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// hotListIDs — V1 fallback only. Kept small to avoid OOM.
// Primary search now uses SlimIndex (all entities, ~170MB).
var hotListIDs = []string{
	"ofac-sdn",
	"un-consolidated",
	"il-nbctf",
}

const hotQuery = `SELECT id, full_name, list_id FROM entities
  WHERE list_id = ANY($1) LIMIT 50000`

// LoadHotEntities loads sanctions + PEP entities into memory.
func LoadHotEntities(db *sql.DB) ([]domain.Entity, error) {
	start := time.Now()

	rows, err := db.Query(hotQuery, hotListIDs)
	if err != nil {
		return nil, fmt.Errorf("hot load query: %w", err)
	}
	defer rows.Close()

	var entities []domain.Entity
	for rows.Next() {
		var id, fullName, listID string
		if err := rows.Scan(&id, &fullName, &listID); err != nil {
			return nil, fmt.Errorf("hot load scan: %w", err)
		}
		eid, _ := domain.NewEntityID(id)
		n, _ := domain.NewName(fullName, "", "", "")
		entities = append(entities, domain.Entity{
			ID:     eid,
			Names:  []domain.Name{n},
			ListID: listID,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("hot load rows: %w", err)
	}

	elapsed := time.Since(start).Milliseconds()
	log.Printf(
		"Loaded %d entities into search index (%d ms)",
		len(entities), elapsed,
	)
	return entities, nil
}
