package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// FindDuplicate returns the ID of an existing open finding with the same
// connection, title, category and severity, or 0 if none exists.
func (s *DB) FindDuplicate(connectionName, title, category, severity string) (int64, error) {
	query := s.bind(`SELECT id FROM security_findings
		WHERE connection_name = ? AND title = ? AND category = ? AND severity = ? AND status = 'open'
		LIMIT 1`)
	var id int64
	err := s.db.QueryRow(query, connectionName, title, category, severity).Scan(&id)
	if err != nil {
		// sql.ErrNoRows means no duplicate
		return 0, nil
	}
	return id, nil
}

// CreateFinding inserts a security finding, skipping if an identical open
// finding already exists (deduplication). The existing ID is set on f.
func (s *DB) CreateFinding(f *FindingRecord) error {
	existingID, err := s.FindDuplicate(f.ConnectionName, f.Title, f.Category, f.Severity)
	if err != nil {
		return fmt.Errorf("dedup check: %w", err)
	}
	if existingID != 0 {
		f.ID = existingID
		return nil
	}

	if f.CreatedAt.IsZero() {
		f.CreatedAt = time.Now().UTC()
	}
	query := s.bind(`INSERT INTO security_findings (connection_name, run_id, severity, category, title, description, remediation, file, line, confidence, false_positive, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

	if s.driver == EnginePostgres {
		return s.db.QueryRow(query+` RETURNING id`,
			f.ConnectionName, f.RunID, f.Severity, f.Category, f.Title, f.Description, f.Remediation, f.File, f.Line, f.Confidence, f.FalsePositive, f.Status, f.CreatedAt,
		).Scan(&f.ID)
	}

	result, err := s.db.Exec(query,
		f.ConnectionName, f.RunID, f.Severity, f.Category, f.Title, f.Description, f.Remediation, f.File, f.Line, f.Confidence, s.boolValue(f.FalsePositive), f.Status, f.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert finding: %w", err)
	}
	f.ID, _ = result.LastInsertId()
	return nil
}

const findingSelectCols = `id, connection_name, run_id, severity, category, title, description,
	remediation, file, line, confidence, false_positive, status, suppression_reason, suppression_note, created_at`

func scanFindingRow(rows *sql.Rows) (FindingRecord, error) {
	var (
		rec      FindingRecord
		falsePos any
	)
	err := rows.Scan(
		&rec.ID, &rec.ConnectionName, &rec.RunID, &rec.Severity, &rec.Category,
		&rec.Title, &rec.Description, &rec.Remediation, &rec.File, &rec.Line,
		&rec.Confidence, &falsePos, &rec.Status,
		&rec.SuppressionReason, &rec.SuppressionNote, &rec.CreatedAt,
	)
	rec.FalsePositive = dbToBool(falsePos)
	return rec, err
}

// ListFindings returns findings, optionally filtered by connection name.
func (s *DB) ListFindings(connectionName string) ([]FindingRecord, error) {
	var (
		rows *sql.Rows
		err  error
	)
	cols := findingSelectCols
	if connectionName != "" {
		rows, err = s.db.Query(
			s.bind(`SELECT `+cols+` FROM security_findings WHERE connection_name = ? ORDER BY created_at DESC`),
			connectionName,
		)
	} else {
		rows, err = s.db.Query(`SELECT ` + cols + ` FROM security_findings ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to list findings: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var findings []FindingRecord
	for rows.Next() {
		rec, err := scanFindingRow(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan finding: %w", err)
		}
		findings = append(findings, rec)
	}
	return findings, rows.Err()
}

// CreateAnalysisRecord inserts an analysis history entry.
