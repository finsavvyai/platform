package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

type AlertRepository struct {
	db *sql.DB
}

func NewAlertRepository(db *sql.DB) *AlertRepository {
	return &AlertRepository{db: db}
}

func (r *AlertRepository) Create(alert domain.Alert) error {
	matchJSON, err := json.Marshal(alert.MatchResult)
	if err != nil {
		return fmt.Errorf("marshal match: %w", err)
	}

	_, err = r.db.Exec(`
		INSERT INTO alerts (
			id, tenant_id, screening_id, entity_id, status, priority,
			assigned_to, resolution, justification, match_result,
			created_at, updated_at, resolved_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		alert.ID,
		alert.TenantID.String(),
		alert.ScreeningID,
		alert.MatchResult.EntityID.String(),
		alert.Status.String(),
		alert.Priority.String(),
		alert.AssignedTo,
		alert.Resolution,
		alert.Justification,
		matchJSON,
		alert.CreatedAt,
		alert.UpdatedAt,
		alert.ResolvedAt,
	)
	return err
}

func (r *AlertRepository) GetByID(id string) (*domain.Alert, error) {
	return nil, fmt.Errorf("not implemented")
}

func (r *AlertRepository) ListByTenant(
	tenantID domain.TenantID) ([]domain.Alert, error) {
	rows, err := r.db.Query(`
		SELECT id, tenant_id, screening_id, status, priority, assigned_to,
		       resolution, justification, match_result, created_at, updated_at,
		       resolved_at
		FROM alerts WHERE tenant_id = $1 ORDER BY created_at DESC
	`, tenantID.String())
	if err != nil {
		return nil, fmt.Errorf("query alerts: %w", err)
	}
	defer rows.Close()

	var results []domain.Alert
	for rows.Next() {
		alert, err := scanAlertFromRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *alert)
	}
	return results, rows.Err()
}

func (r *AlertRepository) Update(alert domain.Alert) error {
	_, err := r.db.Exec(`
		UPDATE alerts SET status = $1, assigned_to = $2, resolution = $3,
		                  justification = $4, updated_at = $5, resolved_at = $6
		WHERE id = $7
	`,
		alert.Status.String(),
		alert.AssignedTo,
		alert.Resolution,
		alert.Justification,
		alert.UpdatedAt,
		alert.ResolvedAt,
		alert.ID,
	)
	return err
}
