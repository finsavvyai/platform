// Asynchronous + critical-path audit log writers — see package doc in
// signer.go for the full contract.
//
// Buffered async writes for high-volume non-critical actions;
// synchronous fail-closed writes for the high-stakes critical-path
// actions named in the portfolio CLAUDE.md (auth, payment, key
// rotation, policy change, retention change). Day 12 of the
// production-ready roadmap.

package audit

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"sync"
)

// Writer persists audit rows to Postgres. Use the high-level helpers
// AppendCritical (sync, fail-closed) and AppendAsync (buffered, never
// blocks the calling goroutine). Construct via NewWriter.
type Writer struct {
	db        *sql.DB
	signer    *Signer
	logger    *slog.Logger
	buffer    chan Row
	bufferCap int
	wg        sync.WaitGroup
	closeOnce sync.Once
	closed    chan struct{}
}

// NewWriter wires a Writer with the given buffer capacity. The async
// goroutine starts immediately and runs until Close is called.
func NewWriter(db *sql.DB, signer *Signer, logger *slog.Logger, bufferCap int) *Writer {
	if bufferCap <= 0 {
		bufferCap = 1024
	}
	if logger == nil {
		logger = slog.Default()
	}
	w := &Writer{
		db:        db,
		signer:    signer,
		logger:    logger,
		buffer:    make(chan Row, bufferCap),
		bufferCap: bufferCap,
		closed:    make(chan struct{}),
	}
	w.wg.Add(1)
	go w.drain()
	return w
}

// AppendCritical writes synchronously and returns any error. Use for
// auth, payment, key rotation, policy change, retention change — the
// caller must propagate the error so the user-facing action fails
// closed if the audit write fails.
func (w *Writer) AppendCritical(ctx context.Context, row Row) error {
	return w.write(ctx, row)
}

// AppendAsync enqueues the row and returns immediately. Returns
// ErrBufferFull when the buffer is saturated; the caller can fall
// back to AppendCritical or drop based on policy.
func (w *Writer) AppendAsync(row Row) error {
	select {
	case w.buffer <- row:
		return nil
	default:
		return ErrBufferFull
	}
}

// ErrBufferFull is returned by AppendAsync when the buffer is full.
var ErrBufferFull = errors.New("audit: write buffer full")

// Close drains the buffer and shuts the writer down. Safe to call
// multiple times.
func (w *Writer) Close() {
	w.closeOnce.Do(func() {
		close(w.buffer)
		w.wg.Wait()
		close(w.closed)
	})
}

// Wait blocks until Close has fully drained.
func (w *Writer) Wait() { <-w.closed }

func (w *Writer) drain() {
	defer w.wg.Done()
	for row := range w.buffer {
		ctx, cancel := contextWithTimeoutDefaults()
		if err := w.write(ctx, row); err != nil {
			// Drop on the floor for async; surfaced via Prometheus
			// counter in the audit_writer_drops_total metric (the
			// metrics wiring follows in the observability commit).
			w.logger.Warn("audit async write failed",
				slog.String("action", row.Action),
				slog.Any("err", err))
		}
		cancel()
	}
}

func (w *Writer) write(ctx context.Context, row Row) error {
	sig, err := w.signer.Sign(row)
	if err != nil {
		return fmt.Errorf("sign: %w", err)
	}
	const stmt = `INSERT INTO audit_logs (
		id, tenant_id, actor_id, actor_type, action,
		target_type, target_id, before_data, after_data,
		created_at, signature
	) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	beforeJSON, afterJSON, err := jsonOrNil(row.Before, row.After)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	if _, err := w.db.ExecContext(ctx, stmt,
		row.TenantID,
		nilOrUUID(row.ActorID),
		row.ActorType,
		row.Action,
		row.TargetType,
		row.TargetID,
		beforeJSON,
		afterJSON,
		row.CreatedAt,
		sig,
	); err != nil {
		return fmt.Errorf("insert: %w", err)
	}
	return nil
}
