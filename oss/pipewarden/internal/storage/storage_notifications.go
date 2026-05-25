package storage

import (
	"fmt"
	"time"
)

// NotificationRow represents a persisted notification.
type NotificationRow struct {
	ID             int64     `json:"id"`
	Type           string    `json:"type"`
	Title          string    `json:"title"`
	Body           string    `json:"body"`
	ConnectionName string    `json:"connection_name,omitempty"`
	Read           bool      `json:"read"`
	CreatedAt      time.Time `json:"created_at"`
}

// CreateNotification inserts a new notification.
func (s *DB) CreateNotification(notifType, title, body, connectionName string) error {
	query := s.bind(`INSERT INTO notifications (type, title, body, connection_name, read, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`)
	now := time.Now().UTC()

	if s.driver == EnginePostgres {
		var id int64
		return s.db.QueryRow(query+` RETURNING id`,
			notifType, title, body, connectionName, false, now,
		).Scan(&id)
	}

	_, err := s.db.Exec(query, notifType, title, body, connectionName, s.boolValue(false), now)
	if err != nil {
		return fmt.Errorf("failed to insert notification: %w", err)
	}
	return nil
}

// ListNotifications returns notifications, optionally filtered to unread only.
func (s *DB) ListNotifications(unreadOnly bool, limit int) ([]NotificationRow, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}

	var query string
	var args []interface{}
	if unreadOnly {
		query = s.bind(`SELECT id, type, title, body, connection_name, read, created_at
			FROM notifications WHERE read = ? ORDER BY created_at DESC LIMIT ?`)
		args = []interface{}{s.boolValue(false), limit}
	} else {
		query = s.bind(`SELECT id, type, title, body, connection_name, read, created_at
			FROM notifications ORDER BY created_at DESC LIMIT ?`)
		args = []interface{}{limit}
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list notifications: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var notifications []NotificationRow
	for rows.Next() {
		var (
			row      NotificationRow
			readVal  any
			connName string
		)
		if err := rows.Scan(&row.ID, &row.Type, &row.Title, &row.Body,
			&connName, &readVal, &row.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}
		row.Read = dbToBool(readVal)
		row.ConnectionName = connName
		notifications = append(notifications, row)
	}
	return notifications, rows.Err()
}

// MarkRead marks a single notification as read.
func (s *DB) MarkRead(id int64) error {
	query := s.bind(`UPDATE notifications SET read = ? WHERE id = ?`)
	result, err := s.db.Exec(query, s.boolValue(true), id)
	if err != nil {
		return fmt.Errorf("failed to mark notification read: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("notification %d not found", id)
	}
	return nil
}

// MarkAllRead marks all notifications as read.
func (s *DB) MarkAllRead() error {
	query := s.bind(`UPDATE notifications SET read = ?`)
	_, err := s.db.Exec(query, s.boolValue(true))
	if err != nil {
		return fmt.Errorf("failed to mark all notifications read: %w", err)
	}
	return nil
}

// UnreadCount returns the number of unread notifications.
func (s *DB) UnreadCount() (int, error) {
	query := s.bind(`SELECT COUNT(*) FROM notifications WHERE read = ?`)
	var count int
	err := s.db.QueryRow(query, s.boolValue(false)).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count unread notifications: %w", err)
	}
	return count, nil
}
