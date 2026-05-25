package pgx

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aegis-aml/aegis/internal/security"
)

// EventAuditRepo implements security.AuditStore using PostgreSQL.
type EventAuditRepo struct {
	pool *pgxpool.Pool
}

// NewEventAuditRepo creates a new audit repository.
func NewEventAuditRepo(pool *pgxpool.Pool) *EventAuditRepo {
	return &EventAuditRepo{pool: pool}
}

// Save inserts an audit entry into the database.
func (r *EventAuditRepo) Save(
	ctx context.Context, entry security.AuditEntry,
) error {
	details, err := json.Marshal(entry.Details)
	if err != nil {
		return fmt.Errorf("marshal details: %w", err)
	}

	_, err = r.pool.Exec(ctx,
		`INSERT INTO audit_events
			(timestamp, request_id, tenant_id, action, details, ip)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		entry.Timestamp, entry.RequestID, entry.TenantID,
		entry.Action, details, entry.IP)
	return err
}

// Query retrieves audit entries matching filter criteria.
func (r *EventAuditRepo) Query(
	ctx context.Context, filter security.AuditFilter,
) ([]security.AuditEntry, error) {
	query := `SELECT timestamp, request_id, tenant_id, action, details, ip
		FROM audit_events WHERE 1=1`
	args := []interface{}{}
	argCount := 1

	if filter.TenantID != "" {
		query += fmt.Sprintf(" AND tenant_id = $%d", argCount)
		args = append(args, filter.TenantID)
		argCount++
	}
	if filter.Action != "" {
		query += fmt.Sprintf(" AND action = $%d", argCount)
		args = append(args, filter.Action)
		argCount++
	}
	if !filter.From.IsZero() {
		query += fmt.Sprintf(" AND timestamp >= $%d", argCount)
		args = append(args, filter.From)
		argCount++
	}
	if !filter.To.IsZero() {
		query += fmt.Sprintf(" AND timestamp <= $%d", argCount)
		args = append(args, filter.To)
		argCount++
	}

	query += " ORDER BY timestamp DESC"
	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, filter.Limit)
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query audit events: %w", err)
	}
	defer rows.Close()

	var entries []security.AuditEntry
	for rows.Next() {
		var e security.AuditEntry
		var detailsJSON []byte
		err := rows.Scan(
			&e.Timestamp, &e.RequestID, &e.TenantID,
			&e.Action, &detailsJSON, &e.IP)
		if err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		err = json.Unmarshal(detailsJSON, &e.Details)
		if err != nil {
			return nil, fmt.Errorf("unmarshal details: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// Purge deletes entries older than the specified time.
func (r *EventAuditRepo) Purge(
	ctx context.Context, before time.Time,
) (int64, error) {
	result, err := r.pool.Exec(ctx,
		`DELETE FROM audit_events WHERE timestamp < $1`, before)
	if err != nil {
		return 0, fmt.Errorf("purge audit events: %w", err)
	}
	return result.RowsAffected(), nil
}
