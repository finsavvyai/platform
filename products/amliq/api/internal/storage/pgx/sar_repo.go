package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SARRepository persists SARs in PostgreSQL.
type SARRepository struct {
	db *sql.DB
}

// NewSARRepository creates the repository.
func NewSARRepository(db *sql.DB) *SARRepository {
	return &SARRepository{db: db}
}

// Create inserts a new SAR.
func (r *SARRepository) Create(ctx context.Context, sar domain.SAR) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO sars (id, tenant_id, case_id, subject_name, subject_type,
			activity_type, narrative_summary, total_amount, filing_status,
			regulatory_body, date_range_from, date_range_to, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		sar.ID, sar.TenantID.String(), sar.CaseID, sar.SubjectName,
		sar.SubjectType, string(sar.ActivityType), sar.NarrativeSummary,
		sar.TotalAmount, string(sar.FilingStatus), string(sar.RegulatoryBody),
		sar.DateRangeFrom, sar.DateRangeTo, sar.CreatedAt,
	)
	return err
}

// GetByID fetches a single SAR.
func (r *SARRepository) GetByID(
	ctx context.Context, id string,
) (*domain.SAR, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, case_id, subject_name, subject_type,
			activity_type, narrative_summary, total_amount, filing_status,
			regulatory_body, date_range_from, date_range_to, created_at
		FROM sars WHERE id=$1`, id)
	return scanSAR(row)
}

// CountByTenant returns the total SAR count for a tenant.
func (r *SARRepository) CountByTenant(
	ctx context.Context, tenantID domain.TenantID,
) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM sars WHERE tenant_id=$1`,
		tenantID.String()).Scan(&count)
	return count, err
}
