package pgx

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"
)

// GeneratedReport stores an immutable SAR/STR report.
type GeneratedReport struct {
	ID         string
	CaseID     string
	TenantID   string
	ReportType string
	Format     string
	Content    []byte
	Hash       string
	CreatedBy  string
	CreatedAt  time.Time
}

// ReportRepository persists generated compliance reports.
type ReportRepository struct {
	db *sql.DB
}

func NewReportRepository(db *sql.DB) *ReportRepository {
	return &ReportRepository{db: db}
}

func (r *ReportRepository) Store(ctx context.Context, report GeneratedReport) error {
	report.Hash = hashContent(report.Content)
	report.ID = fmt.Sprintf("rpt_%d", time.Now().UnixNano())
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO generated_reports
		(id, case_id, tenant_id, report_type, format, content_hash, created_by, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		report.ID, report.CaseID, report.TenantID,
		report.ReportType, report.Format,
		report.Hash, report.CreatedBy, time.Now().UTC())
	return err
}

func (r *ReportRepository) GetByCase(
	ctx context.Context, caseID string,
) ([]GeneratedReport, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, case_id, tenant_id, report_type, format,
		       content_hash, created_by, created_at
		FROM generated_reports WHERE case_id=$1
		ORDER BY created_at DESC`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var reports []GeneratedReport
	for rows.Next() {
		var rpt GeneratedReport
		if err := rows.Scan(&rpt.ID, &rpt.CaseID, &rpt.TenantID,
			&rpt.ReportType, &rpt.Format, &rpt.Hash,
			&rpt.CreatedBy, &rpt.CreatedAt); err != nil {
			return nil, err
		}
		reports = append(reports, rpt)
	}
	return reports, rows.Err()
}

func hashContent(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}
