package screening

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/lib/pq"
)

// EntityFetcher retrieves full entities by ID batch for scoring.
type EntityFetcher struct {
	db *sql.DB
}

// NewEntityFetcher creates a new batch entity fetcher.
func NewEntityFetcher(db *sql.DB) *EntityFetcher {
	return &EntityFetcher{db: db}
}

const fetchByIDsSQL = `SELECT id, full_name, list_id
	FROM entities WHERE id = ANY($1)`

// FetchByIDs retrieves full entities for a batch of IDs.
func (ef *EntityFetcher) FetchByIDs(
	ctx context.Context, ids []string,
) ([]domain.Entity, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	rows, err := ef.db.QueryContext(ctx, fetchByIDsSQL, pq.Array(ids))
	if err != nil {
		return nil, fmt.Errorf("fetch by ids: %w", err)
	}
	defer rows.Close()

	entities := make([]domain.Entity, 0, len(ids))
	for rows.Next() {
		var id, fullName, listID string
		if err := rows.Scan(&id, &fullName, &listID); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		eid, _ := domain.NewEntityID(id)
		n, _ := domain.NewName(fullName, "", "", "")
		entities = append(entities, domain.Entity{
			ID: eid, Names: []domain.Name{n}, ListID: listID,
		})
	}
	return entities, rows.Err()
}
