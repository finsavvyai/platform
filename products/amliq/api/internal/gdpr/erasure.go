package gdpr

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/security"
)

// ErasureReport summarizes what was deleted for a GDPR Article 17 request.
type ErasureReport struct {
	TenantID          string
	CustomerID        string
	ScreeningsDeleted int
	AlertsDeleted     int
	CasesAnonymized   int
	AuditRetained     int
	ErasedAt          time.Time
}

// EraseCustomerData implements GDPR Article 17 (right to erasure)
// scoped to a single tenant. Audit entries are retained (anonymised
// at write-time) so the regulator can prove the request was honoured.
//
// Tenant-scoping is mandatory: a multi-tenant SaaS that lets one
// customer's request delete records belonging to another tenant is a
// SOC 2 / GDPR auditor blocker on day one.
func EraseCustomerData(
	ctx context.Context, db *sql.DB,
	tenantID, customerID string,
) (*ErasureReport, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id required for erasure")
	}
	if customerID == "" {
		return nil, fmt.Errorf("customer_id required for erasure")
	}

	report := &ErasureReport{
		TenantID:   tenantID,
		CustomerID: customerID,
		ErasedAt:   time.Now().UTC(),
	}

	pat := "%" + customerID + "%"

	n, err := execCount(ctx, db,
		`DELETE FROM screenings
		 WHERE tenant_id = $1 AND query_name ILIKE $2`, tenantID, pat)
	if err != nil {
		return nil, fmt.Errorf("erase screenings: %w", err)
	}
	report.ScreeningsDeleted = n

	n, err = execCount(ctx, db,
		`DELETE FROM alerts
		 WHERE tenant_id = $1 AND entity_name ILIKE $2`, tenantID, pat)
	if err != nil {
		return nil, fmt.Errorf("erase alerts: %w", err)
	}
	report.AlertsDeleted = n

	n, err = execCount(ctx, db,
		`UPDATE compliance_cases
		    SET subject_name = 'REDACTED', notes = 'GDPR erasure'
		  WHERE tenant_id = $1 AND subject_name ILIKE $2`,
		tenantID, pat)
	if err != nil {
		return nil, fmt.Errorf("anonymize cases: %w", err)
	}
	report.CasesAnonymized = n

	var auditCount int
	err = db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM audit_entries
		  WHERE tenant_id = $1 AND details ILIKE $2`,
		tenantID, pat).Scan(&auditCount)
	if err != nil {
		return nil, fmt.Errorf("count audit: %w", err)
	}
	report.AuditRetained = auditCount

	logErasure(ctx, db, report)
	return report, nil
}

func execCount(
	ctx context.Context, db *sql.DB,
	query string, args ...interface{},
) (int, error) {
	res, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	affected, _ := res.RowsAffected()
	return int(affected), nil
}

func logErasure(ctx context.Context, db *sql.DB, report *ErasureReport) {
	// Mask any incidental PII in the customer ID before audit. The
	// audit row is regulator-readable; raw email/phone here would
	// re-create the very disclosure the erasure was meant to undo.
	details := security.MaskPII(fmt.Sprintf(
		"customer=%s screenings=%d alerts=%d cases=%d",
		report.CustomerID, report.ScreeningsDeleted,
		report.AlertsDeleted, report.CasesAnonymized,
	))
	_, err := db.ExecContext(ctx,
		`INSERT INTO audit_entries (tenant_id, action, details, created_at)
		 VALUES ($1, $2, $3, $4)`,
		report.TenantID, "gdpr_erasure", details, report.ErasedAt,
	)
	if err != nil {
		log.Printf("failed to log erasure audit: %v", err)
	}
}
