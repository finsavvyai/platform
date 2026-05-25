package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// SaveWebhookConfig upserts outbound webhook configuration.
func (s *DB) SaveWebhookConfig(rec *WebhookConfigRecord) error {
	s.normalizeWebhookConfig(rec)
	now := time.Now().UTC()
	if rec.CreatedAt.IsZero() {
		rec.CreatedAt = now
	}
	rec.UpdatedAt = now

	eventsJSON, err := json.Marshal(rec.Events)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook events: %w", err)
	}

	_, err = s.db.Exec(
		s.bind(`INSERT INTO webhook_configs (name, url, secret, events_json, enabled, last_tested_at, last_status_code, last_error, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(name) DO UPDATE SET
				url = excluded.url,
				secret = excluded.secret,
				events_json = excluded.events_json,
				enabled = excluded.enabled,
				last_tested_at = excluded.last_tested_at,
				last_status_code = excluded.last_status_code,
				last_error = excluded.last_error,
				updated_at = excluded.updated_at`),
		rec.Name, rec.URL, rec.Secret, string(eventsJSON), s.boolValue(rec.Enabled),
		rec.LastTestedAt, rec.LastStatusCode, rec.LastError, rec.CreatedAt, rec.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save webhook config: %w", err)
	}

	saved, err := s.GetWebhookConfig(rec.Name)
	if err != nil {
		return err
	}
	*rec = *saved
	return nil
}

// GetWebhookConfig returns a named webhook configuration.
func (s *DB) GetWebhookConfig(name string) (*WebhookConfigRecord, error) {
	if strings.TrimSpace(name) == "" {
		name = "default"
	}

	var (
		rec          WebhookConfigRecord
		eventsJSON   string
		lastTestedAt sql.NullTime
		enabledValue any
	)
	err := s.db.QueryRow(
		s.bind(`SELECT name, url, secret, events_json, enabled, last_tested_at, last_status_code, last_error, created_at, updated_at
			FROM webhook_configs WHERE name = ?`),
		name,
	).Scan(
		&rec.Name, &rec.URL, &rec.Secret, &eventsJSON, &enabledValue,
		&lastTestedAt, &rec.LastStatusCode, &rec.LastError, &rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("webhook config not found")
		}
		return nil, fmt.Errorf("failed to load webhook config: %w", err)
	}

	rec.Enabled = dbToBool(enabledValue)
	if lastTestedAt.Valid {
		rec.LastTestedAt = &lastTestedAt.Time
	}
	if eventsJSON == "" {
		eventsJSON = "[]"
	}
	if err := json.Unmarshal([]byte(eventsJSON), &rec.Events); err != nil {
		return nil, fmt.Errorf("failed to decode webhook events: %w", err)
	}
	if rec.Events == nil {
		rec.Events = []string{}
	}
	return &rec, nil
}

// UpdateWebhookConfigResult records the last delivery or test outcome.
func (s *DB) UpdateWebhookConfigResult(name string, statusCode int, deliveryErr string) error {
	if strings.TrimSpace(name) == "" {
		name = "default"
	}

	result, err := s.db.Exec(
		s.bind(`UPDATE webhook_configs
			SET last_tested_at = ?, last_status_code = ?, last_error = ?, updated_at = ?
			WHERE name = ?`),
		time.Now().UTC(), statusCode, deliveryErr, time.Now().UTC(), name,
	)
	if err != nil {
		return fmt.Errorf("failed to update webhook config result: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("webhook config %q not found", name)
	}
	return nil
}

func (s *DB) normalizeWebhookConfig(rec *WebhookConfigRecord) {
	if strings.TrimSpace(rec.Name) == "" {
		rec.Name = "default"
	}
	if rec.Events == nil {
		rec.Events = []string{}
	}
}
