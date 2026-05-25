package pgx

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/aegis-aml/aegis/internal/domain"
)

type EDDRepository struct {
	db *sql.DB
}

func NewEDDRepository(db *sql.DB) *EDDRepository {
	return &EDDRepository{db: db}
}

func (r *EDDRepository) Create(
	ctx context.Context, report domain.EDDReport,
) error {
	checkJSON, _ := json.Marshal(report.Checklist)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO edd_reports
		(id, tenant_id, entity_id, entity_name, case_id,
		 status, checklist, notes, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		report.ID, report.TenantID.String(), report.EntityID,
		report.EntityName, report.CaseID,
		string(report.Status), checkJSON, report.Notes,
		report.StartedAt)
	return err
}

func (r *EDDRepository) GetByID(
	ctx context.Context, id string,
) (*domain.EDDReport, error) {
	var rpt domain.EDDReport
	var tid string
	var checkJSON []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, entity_id, entity_name, case_id,
		       status, checklist, notes, completed_by,
		       completed_at, created_at
		FROM edd_reports WHERE id=$1`, id,
	).Scan(&rpt.ID, &tid, &rpt.EntityID, &rpt.EntityName,
		&rpt.CaseID, &rpt.Status, &checkJSON, &rpt.Notes,
		&rpt.Analyst, &rpt.CompletedAt, &rpt.StartedAt)
	if err != nil {
		return nil, err
	}
	rpt.TenantID, _ = domain.NewTenantID(tid)
	_ = json.Unmarshal(checkJSON, &rpt.Checklist)
	return &rpt, nil
}

func (r *EDDRepository) Update(
	ctx context.Context, report domain.EDDReport,
) error {
	checkJSON, _ := json.Marshal(report.Checklist)
	_, err := r.db.ExecContext(ctx, `
		UPDATE edd_reports SET
		  status=$1, checklist=$2, notes=$3,
		  completed_by=$4, completed_at=$5
		WHERE id=$6`,
		string(report.Status), checkJSON, report.Notes,
		report.Analyst, report.CompletedAt, report.ID)
	return err
}
