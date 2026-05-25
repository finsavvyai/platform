package pgx

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ListByTenantID returns SARs for a tenant, optionally filtered by status.
func (r *SARRepository) ListByTenantID(
	ctx context.Context, tenantID domain.TenantID,
	status string, limit int,
) ([]domain.SAR, error) {
	q := `SELECT id, tenant_id, case_id, subject_name, subject_type,
		activity_type, narrative_summary, total_amount, filing_status,
		regulatory_body, date_range_from, date_range_to, created_at
		FROM sars WHERE tenant_id=$1`
	args := []interface{}{tenantID.String()}
	if status != "" {
		q += " AND filing_status=$2"
		args = append(args, status)
	}
	q += " ORDER BY created_at DESC"
	if limit > 0 {
		q += fmt.Sprintf(" LIMIT %d", limit)
	}
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list sars: %w", err)
	}
	defer rows.Close()
	return collectSARs(rows)
}

// Update modifies an existing SAR.
func (r *SARRepository) Update(ctx context.Context, sar domain.SAR) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE sars SET narrative_summary=$1, filing_status=$2,
			regulatory_body=$3, total_amount=$4, filed_at=$5,
			reference_number=$6
		WHERE id=$7`,
		sar.NarrativeSummary, string(sar.FilingStatus),
		string(sar.RegulatoryBody), sar.TotalAmount,
		sar.FiledAt, sar.ReferenceNumber, sar.ID,
	)
	return err
}
