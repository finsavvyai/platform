package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// PolicyRow represents a persisted custom policy.
type PolicyRow struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Enabled     bool      `json:"enabled"`
	Severity    string    `json:"severity"`
	Pattern     string    `json:"pattern"`
	Message     string    `json:"message"`
	Category    string    `json:"category"`
	IsBuiltin   bool      `json:"is_builtin"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreatePolicy inserts a new custom policy.
func (s *DB) CreatePolicy(p PolicyRow) error {
	query := s.bind(`INSERT INTO custom_policies
		(id, name, description, enabled, severity, pattern, message, category, is_builtin, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	_, err := s.db.Exec(query,
		p.ID, p.Name, p.Description, s.boolValue(p.Enabled),
		p.Severity, p.Pattern, p.Message, p.Category,
		s.boolValue(p.IsBuiltin), time.Now().UTC(),
	)
	if err != nil {
		return fmt.Errorf("failed to create policy: %w", err)
	}
	return nil
}

// UpdatePolicy updates a mutable policy by id.
func (s *DB) UpdatePolicy(id string, p PolicyRow) error {
	query := s.bind(`UPDATE custom_policies
		SET name=?, description=?, enabled=?, severity=?, pattern=?, message=?, category=?
		WHERE id=? AND is_builtin=?`)
	res, err := s.db.Exec(query,
		p.Name, p.Description, s.boolValue(p.Enabled),
		p.Severity, p.Pattern, p.Message, p.Category,
		id, s.boolValue(false),
	)
	if err != nil {
		return fmt.Errorf("failed to update policy: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("policy not found or is built-in")
	}
	return nil
}

// DeletePolicy removes a custom policy. Returns an error for built-in policies.
func (s *DB) DeletePolicy(id string) error {
	row := s.db.QueryRow(s.bind(`SELECT is_builtin FROM custom_policies WHERE id=?`), id)
	var rawBuiltin any
	if err := row.Scan(&rawBuiltin); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("policy not found")
		}
		return fmt.Errorf("failed to fetch policy: %w", err)
	}
	if dbToBool(rawBuiltin) {
		return fmt.Errorf("cannot delete built-in policy")
	}
	_, err := s.db.Exec(s.bind(`DELETE FROM custom_policies WHERE id=?`), id)
	if err != nil {
		return fmt.Errorf("failed to delete policy: %w", err)
	}
	return nil
}

// ListPolicies returns all policies (built-in + custom).
func (s *DB) ListPolicies() ([]PolicyRow, error) {
	rows, err := s.db.Query(`SELECT id, name, description, enabled, severity, pattern, message, category, is_builtin, created_at FROM custom_policies ORDER BY created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("failed to list policies: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var policies []PolicyRow
	for rows.Next() {
		p, err := scanPolicyRow(rows)
		if err != nil {
			return nil, err
		}
		policies = append(policies, p)
	}
	return policies, rows.Err()
}

// GetPolicy retrieves a single policy by id.
func (s *DB) GetPolicy(id string) (*PolicyRow, error) {
	rows, err := s.db.Query(
		s.bind(`SELECT id, name, description, enabled, severity, pattern, message, category, is_builtin, created_at FROM custom_policies WHERE id=?`),
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return nil, fmt.Errorf("policy not found")
	}
	p, err := scanPolicyRow(rows)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func scanPolicyRow(rows *sql.Rows) (PolicyRow, error) {
	var (
		p          PolicyRow
		rawEnabled any
		rawBuiltin any
	)
	err := rows.Scan(
		&p.ID, &p.Name, &p.Description, &rawEnabled,
		&p.Severity, &p.Pattern, &p.Message, &p.Category,
		&rawBuiltin, &p.CreatedAt,
	)
	p.Enabled = dbToBool(rawEnabled)
	p.IsBuiltin = dbToBool(rawBuiltin)
	return p, err
}
