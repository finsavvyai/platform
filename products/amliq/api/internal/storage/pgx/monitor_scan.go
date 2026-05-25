package pgx

import (
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanMonitors(rows *sql.Rows) ([]domain.OngoingMonitor, error) {
	var monitors []domain.OngoingMonitor
	for rows.Next() {
		var m domain.OngoingMonitor
		var tid, etype string
		var active bool
		if err := rows.Scan(
			&m.ID, &tid, &m.EntityName, &etype, &m.Frequency,
			&active, &m.LastScreened, &m.NextScreen, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		m.TenantID, _ = domain.NewTenantID(tid)
		m.EntityType, _ = domain.ParseEntityType(etype)
		if active {
			m.Status = domain.MonitorActive
		} else {
			m.Status = domain.MonitorPaused
		}
		monitors = append(monitors, m)
	}
	return monitors, rows.Err()
}
