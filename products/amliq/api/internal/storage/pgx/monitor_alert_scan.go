package pgx

import (
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanMonitorAlert(row *sql.Row) (domain.MonitorAlert, error) {
	var a domain.MonitorAlert
	var tid, atype, sev string
	err := row.Scan(
		&a.ID, &a.ProfileID, &tid, &atype,
		&a.MatchScore, &a.MatchedEntity, &a.PreviousScore,
		&sev, &a.ReviewedBy, &a.ReviewedAt,
		&a.Disposition, &a.CreatedAt,
	)
	if err != nil {
		return a, err
	}
	a.TenantID, _ = domain.NewTenantID(tid)
	a.AlertType = domain.MonitorAlertType(atype)
	a.Severity = domain.MonitorAlertSeverity(sev)
	return a, nil
}

func scanMonitorAlerts(rows *sql.Rows) ([]domain.MonitorAlert, error) {
	var alerts []domain.MonitorAlert
	for rows.Next() {
		var a domain.MonitorAlert
		var tid, atype, sev string
		if err := rows.Scan(
			&a.ID, &a.ProfileID, &tid, &atype,
			&a.MatchScore, &a.MatchedEntity,
			&a.PreviousScore, &sev,
			&a.ReviewedBy, &a.ReviewedAt,
			&a.Disposition, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		a.TenantID, _ = domain.NewTenantID(tid)
		a.AlertType = domain.MonitorAlertType(atype)
		a.Severity = domain.MonitorAlertSeverity(sev)
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}
