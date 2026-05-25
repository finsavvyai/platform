package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

type TxnAlertRepository struct {
	db *sql.DB
}

func NewTxnAlertRepository(db *sql.DB) *TxnAlertRepository {
	return &TxnAlertRepository{db: db}
}

func (r *TxnAlertRepository) Create(
	ctx context.Context, alert domain.TxnAlert,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO txn_alerts
		(id, tenant_id, transaction_id, alert_type, severity, description)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		alert.ID, alert.TenantID.String(), alert.TransactionID,
		string(alert.AlertType), alert.Severity, alert.Description)
	return err
}

func (r *TxnAlertRepository) ListByTenant(
	ctx context.Context, tenantID domain.TenantID, limit int,
) ([]domain.TxnAlert, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, transaction_id, alert_type,
		       severity, description, created_at
		FROM txn_alerts WHERE tenant_id=$1
		ORDER BY created_at DESC LIMIT $2`, tenantID.String(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var alerts []domain.TxnAlert
	for rows.Next() {
		var a domain.TxnAlert
		var tid string
		if err := rows.Scan(&a.ID, &tid, &a.TransactionID,
			&a.AlertType, &a.Severity, &a.Description, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.TenantID, _ = domain.NewTenantID(tid)
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}

func (r *TxnAlertRepository) CountByType(
	ctx context.Context, tenantID domain.TenantID,
) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT alert_type, COUNT(*) FROM txn_alerts
		WHERE tenant_id=$1 GROUP BY alert_type`, tenantID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := make(map[string]int)
	for rows.Next() {
		var t string
		var c int
		if err := rows.Scan(&t, &c); err != nil {
			return nil, err
		}
		counts[t] = c
	}
	return counts, rows.Err()
}
