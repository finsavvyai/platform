package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// SetSchedule upserts a scan schedule for the given connection.
func (s *DB) SetSchedule(connectionName, expr string, enabled bool, notifyOn string) error {
	next := nextRunFromNow()
	query := s.bind(`INSERT INTO scan_schedules (connection_name, cron_expr, enabled, notify_on, next_run_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(connection_name) DO UPDATE SET
			cron_expr   = excluded.cron_expr,
			enabled     = excluded.enabled,
			notify_on   = excluded.notify_on,
			next_run_at = excluded.next_run_at`)

	_, err := s.db.Exec(query, connectionName, expr, s.boolValue(enabled), notifyOn, next)
	if err != nil {
		return fmt.Errorf("failed to set schedule: %w", err)
	}
	return nil
}

// DeleteSchedule removes the scan schedule for the given connection.
func (s *DB) DeleteSchedule(connectionName string) error {
	_, err := s.db.Exec(
		s.bind(`DELETE FROM scan_schedules WHERE connection_name = ?`),
		connectionName,
	)
	if err != nil {
		return fmt.Errorf("failed to delete schedule: %w", err)
	}
	return nil
}

// GetSchedule returns the scan schedule for the given connection.
func (s *DB) GetSchedule(connectionName string) (*ScheduleRow, error) {
	row := s.db.QueryRow(
		s.bind(`SELECT connection_name, cron_expr, enabled, notify_on, last_run_at, next_run_at, created_at
			FROM scan_schedules WHERE connection_name = ?`),
		connectionName,
	)
	return scanScheduleRow(row)
}

// ListDueSchedules returns all enabled schedules whose next_run_at is <= now.
func (s *DB) ListDueSchedules() ([]ScheduleRow, error) {
	rows, err := s.db.Query(
		s.bind(`SELECT connection_name, cron_expr, enabled, notify_on, last_run_at, next_run_at, created_at
			FROM scan_schedules WHERE enabled = ? AND next_run_at <= ?`),
		s.boolValue(true), time.Now().UTC(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list due schedules: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []ScheduleRow
	for rows.Next() {
		rec, err := scanScheduleRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *rec)
	}
	return out, rows.Err()
}

type scheduleScanner interface {
	Scan(dest ...any) error
}

func scanScheduleRow(scanner scheduleScanner) (*ScheduleRow, error) {
	var (
		rec       ScheduleRow
		enabled   any
		lastRunAt sql.NullTime
		nextRunAt sql.NullTime
	)
	if err := scanner.Scan(
		&rec.ConnectionName, &rec.CronExpr, &enabled, &rec.NotifyOn,
		&lastRunAt, &nextRunAt, &rec.CreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("schedule not found")
		}
		return nil, fmt.Errorf("failed to scan schedule: %w", err)
	}
	rec.Enabled = dbToBool(enabled)
	if lastRunAt.Valid {
		rec.LastRunAt = &lastRunAt.Time
	}
	if nextRunAt.Valid {
		rec.NextRunAt = &nextRunAt.Time
	}
	return &rec, nil
}

// nextRunFromNow returns a placeholder next_run_at one hour from now.
// A real scheduler would parse the cron expression.
func nextRunFromNow() time.Time {
	return time.Now().UTC().Add(time.Hour)
}
