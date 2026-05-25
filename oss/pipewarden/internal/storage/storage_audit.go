package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// AuditLogRow represents a persisted audit log entry.
type AuditLogRow struct {
	ID           int64             `json:"id"`
	Action       string            `json:"action"`
	Actor        string            `json:"actor"`
	Resource     string            `json:"resource"`
	ResourceType string            `json:"resource_type"`
	Details      map[string]string `json:"details,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
}

// AppendAuditLog inserts an audit log entry.
func (s *DB) AppendAuditLog(action, actor, resource, resourceType string, details map[string]string) error {
	detailsJSON := "{}"
	if len(details) > 0 {
		b, err := json.Marshal(details)
		if err != nil {
			return fmt.Errorf("failed to marshal audit details: %w", err)
		}
		detailsJSON = string(b)
	}

	query := s.bind(`INSERT INTO audit_log (action, actor, resource, resource_type, details, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`)

	now := time.Now().UTC()
	if s.driver == EnginePostgres {
		var id int64
		return s.db.QueryRow(query+` RETURNING id`,
			action, actor, resource, resourceType, detailsJSON, now,
		).Scan(&id)
	}

	_, err := s.db.Exec(query, action, actor, resource, resourceType, detailsJSON, now)
	if err != nil {
		return fmt.Errorf("failed to insert audit log: %w", err)
	}
	return nil
}

// ListAuditLog returns audit log entries filtered by action and resource.
func (s *DB) ListAuditLog(action, resource string, limit, offset int) ([]AuditLogRow, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	where := "WHERE 1=1"
	args := []interface{}{}
	if action != "" {
		where += " AND action = ?"
		args = append(args, action)
	}
	if resource != "" {
		where += " AND resource = ?"
		args = append(args, resource)
	}
	args = append(args, limit, offset)

	query := s.bind(fmt.Sprintf(
		`SELECT id, action, actor, resource, resource_type, details, created_at
		 FROM audit_log %s ORDER BY created_at DESC LIMIT ? OFFSET ?`, where))

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list audit log: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var entries []AuditLogRow
	for rows.Next() {
		var (
			row         AuditLogRow
			detailsJSON sql.NullString
		)
		if err := rows.Scan(&row.ID, &row.Action, &row.Actor, &row.Resource,
			&row.ResourceType, &detailsJSON, &row.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan audit row: %w", err)
		}
		if detailsJSON.Valid && detailsJSON.String != "" && detailsJSON.String != "{}" {
			_ = json.Unmarshal([]byte(detailsJSON.String), &row.Details)
		}
		entries = append(entries, row)
	}
	return entries, rows.Err()
}

// CountAuditLog returns the total count of matching audit log entries.
func (s *DB) CountAuditLog(action, resource string) (int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	if action != "" {
		where += " AND action = ?"
		args = append(args, action)
	}
	if resource != "" {
		where += " AND resource = ?"
		args = append(args, resource)
	}

	query := s.bind(fmt.Sprintf(`SELECT COUNT(*) FROM audit_log %s`, where))
	var count int
	err := s.db.QueryRow(query, args...).Scan(&count)
	return count, err
}
