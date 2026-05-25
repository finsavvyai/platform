package pgx

import (
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanListMonitors(rows *sql.Rows) ([]domain.ListMonitor, error) {
	var results []domain.ListMonitor
	for rows.Next() {
		m, err := scanListMonitorRow(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, m)
	}
	return results, rows.Err()
}

func scanListMonitorRow(rows *sql.Rows) (domain.ListMonitor, error) {
	var m domain.ListMonitor
	var tenantID string
	err := rows.Scan(
		&m.ID, &tenantID, &m.ListSource,
		&m.LastSyncedAt, &m.NextSyncAt,
		&m.Status, &m.ErrorMessage,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return domain.ListMonitor{}, err
	}
	m.TenantID, _ = domain.NewTenantID(tenantID)
	return m, nil
}
