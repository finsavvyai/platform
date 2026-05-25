package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

type CaseQueryRepository struct {
	db *sql.DB
}

func NewCaseQueryRepository(db *sql.DB) *CaseQueryRepository {
	return &CaseQueryRepository{db: db}
}

func (r *CaseQueryRepository) ListByTenant(
	ctx context.Context, tenantID domain.TenantID, status string, limit int,
) ([]domain.ComplianceCase, error) {
	q := `SELECT id, tenant_id, screening_id, entity_name, matched_name,
	             list_id, confidence, status, priority, assigned_to,
	             created_at, updated_at
	      FROM compliance_cases WHERE tenant_id=$1`
	args := []interface{}{tenantID.String()}
	if status != "" {
		q += " AND status=$2"
		args = append(args, status)
	}
	q += " ORDER BY created_at DESC"
	if limit > 0 {
		q += " LIMIT " + itoa(limit)
	}
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCases(rows)
}

func (r *CaseQueryRepository) CountByStatus(
	ctx context.Context, tenantID domain.TenantID,
) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT status, COUNT(*) FROM compliance_cases
		WHERE tenant_id=$1 GROUP BY status`, tenantID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := make(map[string]int)
	for rows.Next() {
		var s string
		var c int
		if err := rows.Scan(&s, &c); err != nil {
			return nil, err
		}
		counts[s] = c
	}
	return counts, rows.Err()
}
