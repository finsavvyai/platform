package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

type ScreeningRepository struct {
	db *sql.DB
}

func NewScreeningRepository(db *sql.DB) *ScreeningRepository {
	return &ScreeningRepository{db: db}
}

func (r *ScreeningRepository) Create(response domain.ScreenResponse) error {
	resultJSON, err := json.Marshal(response)
	if err != nil {
		return fmt.Errorf("marshal response: %w", err)
	}

	disposition := "none"
	if len(response.Matches) > 0 {
		disposition = response.Matches[0].Disposition.String()
	}

	_, err = r.db.Exec(`
		INSERT INTO screenings (
			id, tenant_id, entity_id, max_confidence, disposition,
			processing_time_ms, result_json, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`,
		response.ID,
		response.Request.TenantID.String(),
		response.Request.Entity.ID.String(),
		response.MaxConfidence(),
		disposition,
		response.ProcessingTime.Milliseconds(),
		resultJSON,
		response.Timestamp,
	)
	return err
}

func (r *ScreeningRepository) GetByID(id string) (*domain.ScreenResponse, error) {
	row := r.db.QueryRow(`
		SELECT id, tenant_id, entity_id, max_confidence, disposition,
		       processing_time_ms, result_json, created_at
		FROM screenings WHERE id = $1
	`, id)

	return scanScreening(row)
}

func (r *ScreeningRepository) ListByTenant(
	tenantID domain.TenantID) ([]domain.ScreenResponse, error) {
	rows, err := r.db.Query(`
		SELECT id, tenant_id, entity_id, max_confidence, disposition,
		       processing_time_ms, result_json, created_at
		FROM screenings WHERE tenant_id = $1 ORDER BY created_at DESC
	`, tenantID.String())
	if err != nil {
		return nil, fmt.Errorf("query screenings: %w", err)
	}
	defer rows.Close()

	var results []domain.ScreenResponse
	for rows.Next() {
		resp, err := scanScreeningFromRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *resp)
	}
	return results, rows.Err()
}
