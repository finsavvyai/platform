package storage

import (
	"database/sql"
	"fmt"
	"time"
)

func (s *DB) CreateAnalysisRecord(r *AnalysisRecord) error {
	if r.AnalyzedAt.IsZero() {
		r.AnalyzedAt = time.Now().UTC()
	}
	query := s.bind(`INSERT INTO analysis_history (connection_name, run_id, summary, risk_score, findings_count, tokens_used, model, duration_ms, analyzed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)

	if s.driver == EnginePostgres {
		return s.db.QueryRow(query+` RETURNING id`,
			r.ConnectionName, r.RunID, r.Summary, r.RiskScore, r.FindingsCount, r.TokensUsed, r.Model, r.DurationMS, r.AnalyzedAt,
		).Scan(&r.ID)
	}

	result, err := s.db.Exec(query,
		r.ConnectionName, r.RunID, r.Summary, r.RiskScore, r.FindingsCount, r.TokensUsed, r.Model, r.DurationMS, r.AnalyzedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert analysis record: %w", err)
	}
	r.ID, _ = result.LastInsertId()
	return nil
}

// ListAnalysisHistory returns analysis history, optionally filtered by connection.
func (s *DB) ListAnalysisHistory(connectionName string) ([]AnalysisRecord, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if connectionName != "" {
		rows, err = s.db.Query(
			s.bind(`SELECT id, connection_name, run_id, summary, risk_score, findings_count, tokens_used, model, duration_ms, analyzed_at
				FROM analysis_history WHERE connection_name = ? ORDER BY analyzed_at DESC`),
			connectionName,
		)
	} else {
		rows, err = s.db.Query(
			`SELECT id, connection_name, run_id, summary, risk_score, findings_count, tokens_used, model, duration_ms, analyzed_at
			 FROM analysis_history ORDER BY analyzed_at DESC`,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to list analysis history: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var records []AnalysisRecord
	for rows.Next() {
		var r AnalysisRecord
		if err := rows.Scan(&r.ID, &r.ConnectionName, &r.RunID, &r.Summary, &r.RiskScore, &r.FindingsCount, &r.TokensUsed, &r.Model, &r.DurationMS, &r.AnalyzedAt); err != nil {
			return nil, fmt.Errorf("failed to scan analysis record: %w", err)
		}
		records = append(records, r)
	}
	return records, rows.Err()
}

// LastAnalysisTime returns the most recent analysis timestamp, if any.
func (s *DB) LastAnalysisTime() (*time.Time, error) {
	var ts sql.NullTime
	if err := s.db.QueryRow(`SELECT analyzed_at FROM analysis_history ORDER BY analyzed_at DESC LIMIT 1`).Scan(&ts); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if !ts.Valid {
		return nil, nil
	}
	t := ts.Time
	return &t, nil
}

// LastAnalysisTimeForConnection returns the most recent analysis timestamp for
// a specific connection, or nil if no analysis has been run.
func (s *DB) LastAnalysisTimeForConnection(connectionName string) (*time.Time, error) {
	var ts sql.NullTime
	query := s.bind(`SELECT analyzed_at FROM analysis_history WHERE connection_name = ? ORDER BY analyzed_at DESC LIMIT 1`)
	if err := s.db.QueryRow(query, connectionName).Scan(&ts); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if !ts.Valid {
		return nil, nil
	}
	t := ts.Time
	return &t, nil
}

// UpdateFindingStatus updates the status of a finding by ID.
func (s *DB) UpdateFindingStatus(id int64, status string) error {
	result, err := s.db.Exec(
		s.bind(`UPDATE security_findings SET status = ?, false_positive = ? WHERE id = ?`),
		status, s.boolValue(status == "false_positive"), id,
	)
	if err != nil {
		return fmt.Errorf("failed to update finding: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("finding %d not found", id)
	}
	return nil
}

// DeleteFinding removes a finding by ID.
func (s *DB) DeleteFinding(id int64) error {
	result, err := s.db.Exec(s.bind(`DELETE FROM security_findings WHERE id = ?`), id)
	if err != nil {
		return fmt.Errorf("failed to delete finding: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("finding %d not found", id)
	}
	return nil
}

// GetFindingStats returns aggregate counts of findings by severity and status.
func (s *DB) GetFindingStats() (map[string]int, error) {
	stats := make(map[string]int)
	rows, err := s.db.Query(`SELECT severity, COUNT(*) FROM security_findings WHERE status != 'false_positive' GROUP BY severity`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var (
			severity string
			count    int
		)
		if err := rows.Scan(&severity, &count); err != nil {
			return nil, err
		}
		stats[severity] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var openCount int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM security_findings WHERE status = 'open'`).Scan(&openCount); err != nil {
		return nil, err
	}
	stats["open"] = openCount
	return stats, nil
}
