package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

type CaseRepository struct {
	db *sql.DB
}

func NewCaseRepository(db *sql.DB) *CaseRepository {
	return &CaseRepository{db: db}
}

func (r *CaseRepository) Create(ctx context.Context, c domain.ComplianceCase) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO compliance_cases
		(id, tenant_id, screening_id, entity_name, matched_name,
		 list_id, confidence, status, priority, assigned_to, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		c.ID, c.TenantID.String(), c.ScreeningID, c.EntityName,
		c.MatchedName, c.ListID, c.Confidence,
		string(c.Status), string(c.Priority),
		c.AssignedTo, c.CreatedAt, c.UpdatedAt)
	return err
}

func (r *CaseRepository) GetByID(
	ctx context.Context, id string,
) (*domain.ComplianceCase, error) {
	var c domain.ComplianceCase
	var tid string
	err := r.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, screening_id, entity_name, matched_name,
		       list_id, confidence, status, priority, assigned_to,
		       resolution, resolved_by, resolved_at, created_at, updated_at
		FROM compliance_cases WHERE id=$1`, id,
	).Scan(&c.ID, &tid, &c.ScreeningID, &c.EntityName,
		&c.MatchedName, &c.ListID, &c.Confidence,
		&c.Status, &c.Priority, &c.AssignedTo,
		&c.Resolution, &c.ResolvedBy, &c.ResolvedAt,
		&c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	c.TenantID, _ = domain.NewTenantID(tid)
	return &c, nil
}

func (r *CaseRepository) Update(ctx context.Context, c domain.ComplianceCase) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE compliance_cases SET
		  status=$1, priority=$2, assigned_to=$3,
		  resolution=$4, resolved_by=$5, resolved_at=$6, updated_at=$7
		WHERE id=$8`,
		string(c.Status), string(c.Priority), c.AssignedTo,
		c.Resolution, c.ResolvedBy, c.ResolvedAt,
		c.UpdatedAt, c.ID)
	return err
}

func (r *CaseRepository) UpdateStatus(ctx context.Context, caseID, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE compliance_cases SET status=$1, updated_at=NOW() WHERE id=$2`,
		status, caseID)
	return err
}
