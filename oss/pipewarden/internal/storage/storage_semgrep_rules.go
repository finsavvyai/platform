package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// SemgrepRuleRow represents a persisted custom Semgrep rule.
type SemgrepRuleRow struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Pattern     string    `json:"pattern"`
	Language    string    `json:"language"`
	Severity    string    `json:"severity"`
	Message     string    `json:"message"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateSemgrepRule inserts a new custom Semgrep rule.
func (s *DB) CreateSemgrepRule(r SemgrepRuleRow) error {
	query := s.bind(`INSERT INTO semgrep_rules
		(id, name, description, pattern, language, severity, message, enabled, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	_, err := s.db.Exec(query,
		r.ID, r.Name, r.Description, r.Pattern,
		r.Language, r.Severity, r.Message,
		s.boolValue(r.Enabled), time.Now().UTC(),
	)
	if err != nil {
		return fmt.Errorf("failed to create semgrep rule: %w", err)
	}
	return nil
}

// ListSemgrepRules returns all stored Semgrep rules ordered by creation time.
func (s *DB) ListSemgrepRules() ([]SemgrepRuleRow, error) {
	rows, err := s.db.Query(
		`SELECT id, name, description, pattern, language, severity, message, enabled, created_at
		 FROM semgrep_rules ORDER BY created_at ASC`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list semgrep rules: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var rules []SemgrepRuleRow
	for rows.Next() {
		r, err := scanSemgrepRuleRow(rows)
		if err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, rows.Err()
}

// GetSemgrepRule retrieves a single rule by id.
func (s *DB) GetSemgrepRule(id string) (*SemgrepRuleRow, error) {
	rows, err := s.db.Query(
		s.bind(`SELECT id, name, description, pattern, language, severity, message, enabled, created_at
		        FROM semgrep_rules WHERE id=?`),
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get semgrep rule: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return nil, fmt.Errorf("semgrep rule not found")
	}
	r, err := scanSemgrepRuleRow(rows)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// DeleteSemgrepRule removes a rule by id.
func (s *DB) DeleteSemgrepRule(id string) error {
	res, err := s.db.Exec(s.bind(`DELETE FROM semgrep_rules WHERE id=?`), id)
	if err != nil {
		return fmt.Errorf("failed to delete semgrep rule: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("semgrep rule not found")
	}
	return nil
}

func scanSemgrepRuleRow(rows *sql.Rows) (SemgrepRuleRow, error) {
	var (
		r          SemgrepRuleRow
		rawEnabled any
	)
	err := rows.Scan(
		&r.ID, &r.Name, &r.Description, &r.Pattern,
		&r.Language, &r.Severity, &r.Message,
		&rawEnabled, &r.CreatedAt,
	)
	r.Enabled = dbToBool(rawEnabled)
	return r, err
}
