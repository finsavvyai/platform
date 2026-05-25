package pgx

import (
	"database/sql"
	"encoding/json"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanMonitorProfile(row *sql.Row) (domain.MonitorProfile, error) {
	var p domain.MonitorProfile
	var tid, etype, risk, freq, status string
	var lists []byte
	err := row.Scan(
		&p.ID, &tid, &p.EntityName, &etype,
		&risk, &lists, &freq, &status,
		&p.LastScreenedAt, &p.NextScreenAt,
		&p.MatchCount, &p.CreatedAt,
	)
	if err != nil {
		return p, err
	}
	p.TenantID, _ = domain.NewTenantID(tid)
	p.EntityType, _ = domain.ParseEntityType(etype)
	p.RiskLevel = domain.RiskLevel(risk)
	p.Frequency = domain.MonitorFrequency(freq)
	p.Status = domain.MonitorStatus(status)
	_ = json.Unmarshal(lists, &p.ListsToScreen)
	return p, nil
}

func scanMonitorProfiles(rows *sql.Rows) ([]domain.MonitorProfile, error) {
	var profiles []domain.MonitorProfile
	for rows.Next() {
		var p domain.MonitorProfile
		var tid, etype, risk, freq, status string
		var lists []byte
		if err := rows.Scan(
			&p.ID, &tid, &p.EntityName, &etype,
			&risk, &lists, &freq, &status,
			&p.LastScreenedAt, &p.NextScreenAt,
			&p.MatchCount, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		p.TenantID, _ = domain.NewTenantID(tid)
		p.EntityType, _ = domain.ParseEntityType(etype)
		p.RiskLevel = domain.RiskLevel(risk)
		p.Frequency = domain.MonitorFrequency(freq)
		p.Status = domain.MonitorStatus(status)
		_ = json.Unmarshal(lists, &p.ListsToScreen)
		profiles = append(profiles, p)
	}
	return profiles, rows.Err()
}
