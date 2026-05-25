package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// SecretLifecycleRow represents one row in the secret_lifecycle table.
type SecretLifecycleRow struct {
	ID            int64      `json:"id"`
	FindingID     int64      `json:"finding_id"`
	PatternName   string     `json:"pattern_name"`
	RedactedValue string     `json:"redacted_value"`
	Status        string     `json:"status"`
	FirstSeenAt   time.Time  `json:"first_seen_at"`
	LastSeenAt    time.Time  `json:"last_seen_at"`
	RevokedAt     *time.Time `json:"revoked_at,omitempty"`
	Notes         string     `json:"notes,omitempty"`
}

// UpsertSecretLifecycle inserts a new secret lifecycle entry or updates
// last_seen_at when an entry with the same finding_id already exists.
func (s *DB) UpsertSecretLifecycle(findingID int64, patternName, redactedValue string) error {
	now := time.Now().UTC()

	// Check for existing row with same finding_id
	var id int64
	err := s.db.QueryRow(
		s.bind(`SELECT id FROM secret_lifecycle WHERE finding_id = ? LIMIT 1`),
		findingID,
	).Scan(&id)

	if err == sql.ErrNoRows {
		// Insert new row
		_, err = s.db.Exec(
			s.bind(`INSERT INTO secret_lifecycle
				(finding_id, pattern_name, redacted_value, status, first_seen_at, last_seen_at)
				VALUES (?, ?, ?, 'active', ?, ?)`),
			findingID, patternName, redactedValue, now, now,
		)
		return wrapErr("insert secret lifecycle", err)
	}
	if err != nil {
		return fmt.Errorf("upsert secret lifecycle lookup: %w", err)
	}

	// Update last_seen_at on existing row
	_, err = s.db.Exec(
		s.bind(`UPDATE secret_lifecycle SET last_seen_at = ? WHERE id = ?`),
		now, id,
	)
	return wrapErr("update secret lifecycle", err)
}

// RevokeSecret sets the status of a secret to 'revoked' and records revoked_at.
func (s *DB) RevokeSecret(findingID int64, notes string) error {
	now := time.Now().UTC()
	result, err := s.db.Exec(
		s.bind(`UPDATE secret_lifecycle
			SET status = 'revoked', revoked_at = ?, notes = ?
			WHERE finding_id = ?`),
		now, notes, findingID,
	)
	if err != nil {
		return fmt.Errorf("revoke secret: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("secret lifecycle entry for finding %d not found", findingID)
	}
	return nil
}

// ListSecretLifecycle returns all secret lifecycle rows, optionally filtered
// by status. Pass an empty string to return all statuses.
func (s *DB) ListSecretLifecycle(status string) ([]SecretLifecycleRow, error) {
	var (
		rows *sql.Rows
		err  error
	)

	cols := `id, finding_id, pattern_name, redacted_value, status,
		first_seen_at, last_seen_at, revoked_at, notes`

	if status != "" {
		rows, err = s.db.Query(
			s.bind(`SELECT `+cols+` FROM secret_lifecycle WHERE status = ? ORDER BY first_seen_at DESC`),
			status,
		)
	} else {
		rows, err = s.db.Query(
			`SELECT ` + cols + ` FROM secret_lifecycle ORDER BY first_seen_at DESC`,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("list secret lifecycle: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var result []SecretLifecycleRow
	for rows.Next() {
		var r SecretLifecycleRow
		var revokedAt sql.NullTime
		var notes sql.NullString
		if err := rows.Scan(
			&r.ID, &r.FindingID, &r.PatternName, &r.RedactedValue,
			&r.Status, &r.FirstSeenAt, &r.LastSeenAt, &revokedAt, &notes,
		); err != nil {
			return nil, fmt.Errorf("scan secret lifecycle row: %w", err)
		}
		if revokedAt.Valid {
			r.RevokedAt = &revokedAt.Time
		}
		if notes.Valid {
			r.Notes = notes.String
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// wrapErr returns nil for a nil error, or a wrapped error with context.
func wrapErr(context string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", context, err)
}
