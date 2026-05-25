package pgx

import (
	"database/sql"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func lastWord(s string) string {
	parts := strings.Fields(s)
	if len(parts) == 0 {
		return s
	}
	return parts[len(parts)-1]
}

type EntityRepository struct {
	db *sql.DB
}

func NewEntityRepository(db *sql.DB) *EntityRepository {
	return &EntityRepository{db: db}
}

func (r *EntityRepository) Create(entity domain.Entity) error {
	_, err := r.db.Exec(`
		INSERT INTO entities (
			id, type, full_name, given_name, family_name,
			original_script, dob, nationalities, list_id, metadata,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`,
		entity.ID.String(),
		entity.Type.String(),
		entity.PrimaryName().Full,
		entity.PrimaryName().Given,
		entity.PrimaryName().Family,
		entity.PrimaryName().OriginalScript,
		entity.DOB,
		entity.Nationalities,
		entity.ListID,
		entity.Metadata,
		entity.CreatedAt,
		entity.UpdatedAt,
	)
	return err
}

func (r *EntityRepository) GetByID(
	id domain.EntityID,
) (*domain.Entity, error) {
	row := r.db.QueryRow(`
		SELECT id, type, full_name, given_name, family_name,
		       original_script, dob, nationalities, list_id,
		       metadata, created_at, updated_at,
		       addresses, identifiers, aliases
		FROM entities WHERE id = $1
	`, id.String())
	return scanEntity(row)
}

func (r *EntityRepository) Search(query string) ([]domain.Entity, error) {
	// Search: match ALL words individually so "Vladimir Putin"
	// finds "PUTIN, Vladimir Vladimirovich"
	rows, err := r.db.Query(`
		SELECT id, type, full_name, given_name, family_name,
		       original_script, dob, nationalities, list_id,
		       metadata, created_at, updated_at,
		       addresses, identifiers, aliases
		FROM entities
		WHERE full_name ILIKE '%' || $1 || '%'
		   OR full_name ILIKE '%' || $2 || '%'
		   OR family_name ILIKE '%' || $1 || '%'
		   OR given_name ILIKE '%' || $1 || '%'
		LIMIT 200
	`, query, lastWord(query))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []domain.Entity
	for rows.Next() {
		ent, err := scanEntityFromRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *ent)
	}
	return results, rows.Err()
}

func (r *EntityRepository) ListUpdatedSince(since time.Time) ([]domain.Entity, error) {
	rows, err := r.db.Query(`
		SELECT id, type, full_name, given_name, family_name,
		       original_script, dob, nationalities, list_id,
		       metadata, created_at, updated_at,
		       addresses, identifiers, aliases
		FROM entities WHERE updated_at >= $1
		ORDER BY updated_at DESC LIMIT 5000
	`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []domain.Entity
	for rows.Next() {
		ent, err := scanEntityFromRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *ent)
	}
	return results, rows.Err()
}

func (r *EntityRepository) Delete(id domain.EntityID) error {
	_, err := r.db.Exec(
		"DELETE FROM entities WHERE id = $1", id.String())
	return err
}
