package screening

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// PGSearcher queries PostgreSQL using trigram, soundex, and normalized indexes.
type PGSearcher struct {
	db *sql.DB
}

// NewPGSearcher creates a searcher backed by PostgreSQL.
func NewPGSearcher(db *sql.DB) *PGSearcher {
	return &PGSearcher{db: db}
}

// Search finds entities matching name using combined index query.
func (ps *PGSearcher) Search(
	name string, opts SearchOpts,
) ([]domain.Entity, error) {
	if name == "" {
		return nil, fmt.Errorf("search name required")
	}
	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}

	entities, err := ps.trigramSearch(name, limit)
	if err != nil {
		return nil, err
	}
	if len(entities) == 0 {
		entities, err = ps.ilikeSearch(name, limit)
	}
	return entities, err
}

const trigramSQL = `SELECT id, full_name, list_id,
  similarity(full_name, $1) AS sim
  FROM entities
  WHERE full_name % $1
     OR soundex_code = soundex($1)
     OR name_normalized = lower(regexp_replace($1, '[^a-z ]', '', 'gi'))
  ORDER BY sim DESC LIMIT $2`

func (ps *PGSearcher) trigramSearch(
	name string, limit int,
) ([]domain.Entity, error) {
	rows, err := ps.db.Query(trigramSQL, name, limit)
	if err != nil {
		return nil, fmt.Errorf("trigram search: %w", err)
	}
	defer rows.Close()
	return ps.scanEntities(rows)
}

const ilikeSQL = `SELECT id, full_name, list_id, 0.0 AS sim
  FROM entities WHERE full_name ILIKE $1
  ORDER BY full_name LIMIT $2`

func (ps *PGSearcher) ilikeSearch(
	name string, limit int,
) ([]domain.Entity, error) {
	pattern := "%" + strings.ReplaceAll(name, "%", "") + "%"
	rows, err := ps.db.Query(ilikeSQL, pattern, limit)
	if err != nil {
		return nil, fmt.Errorf("ilike search: %w", err)
	}
	defer rows.Close()
	return ps.scanEntities(rows)
}

func (ps *PGSearcher) scanEntities(
	rows *sql.Rows,
) ([]domain.Entity, error) {
	var results []domain.Entity
	for rows.Next() {
		var id, fullName, listID string
		var sim float64
		if err := rows.Scan(&id, &fullName, &listID, &sim); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		eid, _ := domain.NewEntityID(id)
		n, _ := domain.NewName(fullName, "", "", "")
		e := domain.Entity{ID: eid, Names: []domain.Name{n}, ListID: listID}
		results = append(results, e)
	}
	return results, rows.Err()
}
