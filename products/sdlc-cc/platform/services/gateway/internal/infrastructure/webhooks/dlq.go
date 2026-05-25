// Package webhooks — DLQ persistence + replay.
//
// DLQ implementations write failed deliveries to durable storage so an
// operator can inspect, fix the receiver, and Replay. PostgresDLQ uses
// database/sql so it works with both pgx-stdlib and sqlmock in tests.
//
// Schema: see database/migrations/018_webhook_dlq.sql.
package webhooks

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// PostgresDLQ writes DLQ entries to the webhook_dlq table.
type PostgresDLQ struct {
	DB *sql.DB
}

// NewPostgresDLQ constructs a PostgresDLQ. Caller owns the *sql.DB.
func NewPostgresDLQ(db *sql.DB) *PostgresDLQ { return &PostgresDLQ{DB: db} }

// Push implements DLQ.
func (p *PostgresDLQ) Push(ctx context.Context, e DLQEntry) error {
	if p.DB == nil {
		return errors.New("webhooks: PostgresDLQ has nil *sql.DB")
	}
	hdrJSON, err := json.Marshal(e.Headers)
	if err != nil {
		return fmt.Errorf("dlq marshal headers: %w", err)
	}
	const q = `
		INSERT INTO webhook_dlq
		(endpoint_id, tenant_id, url, payload, headers,
		 attempts, last_status, last_error, failed_at, replayed)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, false)
	`
	_, err = p.DB.ExecContext(ctx, q,
		e.EndpointID, e.TenantID, e.URL, e.Payload, hdrJSON,
		e.Attempts, e.LastStatus, e.LastError, e.FailedAt,
	)
	return err
}

// Reenqueuer is the seam Replay calls into to put the entry back on
// the live retrier (typically a Redis stream). Tests inject a fake.
type Reenqueuer interface {
	Reenqueue(ctx context.Context, e DLQEntry) error
}

// Replay pulls the entry by id, hands it to the Reenqueuer, and marks
// it replayed. Idempotent on already-replayed rows (returns ErrAlreadyReplayed).
func (p *PostgresDLQ) Replay(ctx context.Context, id int64, q Reenqueuer) error {
	if p.DB == nil {
		return errors.New("webhooks: PostgresDLQ has nil *sql.DB")
	}
	const sel = `
		SELECT endpoint_id, tenant_id, url, payload, headers,
		       attempts, last_status, last_error, failed_at, replayed
		FROM webhook_dlq WHERE id = $1
	`
	row := p.DB.QueryRowContext(ctx, sel, id)
	var (
		entry        DLQEntry
		hdrRaw       []byte
		failedAt     time.Time
		alreadyReplayed bool
	)
	if err := row.Scan(
		&entry.EndpointID, &entry.TenantID, &entry.URL, &entry.Payload, &hdrRaw,
		&entry.Attempts, &entry.LastStatus, &entry.LastError, &failedAt, &alreadyReplayed,
	); err != nil {
		return fmt.Errorf("dlq lookup %d: %w", id, err)
	}
	if alreadyReplayed {
		return ErrAlreadyReplayed
	}
	if err := json.Unmarshal(hdrRaw, &entry.Headers); err != nil {
		return fmt.Errorf("dlq decode headers: %w", err)
	}
	entry.FailedAt = failedAt

	if err := q.Reenqueue(ctx, entry); err != nil {
		return fmt.Errorf("dlq reenqueue: %w", err)
	}
	const upd = `UPDATE webhook_dlq SET replayed = true, replayed_at = $2 WHERE id = $1`
	if _, err := p.DB.ExecContext(ctx, upd, id, time.Now().UTC()); err != nil {
		return fmt.Errorf("dlq mark replayed: %w", err)
	}
	return nil
}

// ErrAlreadyReplayed is returned when Replay is called twice on the same id.
var ErrAlreadyReplayed = errors.New("webhooks: dlq entry already replayed")
