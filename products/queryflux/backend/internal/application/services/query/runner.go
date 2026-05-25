// Package query implements the safe query runner.
//
// The runner is the single chokepoint that all callers (HTTP handlers,
// scheduled jobs, MCP server) MUST use to execute SQL against a
// DatabaseAdapter. It enforces context-based timeouts, max-row caps,
// parameter/placeholder validation, credential redaction and audit
// logging. It does NOT talk to drivers directly — every database
// interaction goes through a small adapter interface defined here so
// the runner stays decoupled from the infrastructure layer.
package query

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Default policy values applied when QueryOptions zero-values are passed.
const (
	DefaultTimeout    = 30 * time.Second
	DefaultMaxRows    = int64(10000)
	DefaultBatchSize  = 500
	DefaultChanBuffer = 8
)

// ExecuteAdapter is the slice of DatabaseAdapter the runner needs for
// the non-streaming Execute path. It is intentionally narrow so that
// fakes used in tests do not have to satisfy the full adapter contract.
type ExecuteAdapter interface {
	ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error)
}

// StreamAdapter is implemented by adapters that support cursor-based
// streaming. Added in Phase 1 Task #7; until that lands the runner
// type-asserts at call time and falls back to chunking the Execute
// result if Stream is unavailable.
type StreamAdapter interface {
	Stream(ctx context.Context, query string, params ...interface{}) (<-chan StreamRow, <-chan error)
}

// StreamRow is the row envelope pushed to a streaming consumer. The
// shape mirrors types.StreamRow added by Task #7; it is duplicated
// here so this package compiles ahead of that change.
type StreamRow struct {
	Columns []string
	Values  []interface{}
	Index   int64
}

// QueryOptions configures a single Execute or Stream call.
type QueryOptions struct {
	Timeout      time.Duration // 0 → DefaultTimeout
	MaxRows      int64         // 0 → DefaultMaxRows
	BatchSize    int           // 0 → DefaultBatchSize (Stream only)
	ReadOnly     bool          // reject DML when true (validated upstream)
	ConnectionID string        // for audit
	UserID       string        // pulled from ctx if empty
	FullSQL      bool          // emit raw SQL into audit row (default false)
}

// SafeQueryRunner is the production implementation of the safe runner.
// It is safe for concurrent use; all state is read-only after New.
type SafeQueryRunner struct {
	audit  AuditLogger
	clock  func() time.Time
	defOps QueryOptions
}

// NewSafeQueryRunner builds a runner with the supplied audit sink. If
// audit is nil the runner uses NopAuditLogger so production callers
// never panic on a missing dependency.
func NewSafeQueryRunner(audit AuditLogger) *SafeQueryRunner {
	if audit == nil {
		audit = NopAuditLogger{}
	}
	return &SafeQueryRunner{
		audit: audit,
		clock: time.Now,
	}
}

// Execute runs sql against adapter under the supplied options. The
// returned QueryResult is the adapter's response with Truncated set
// if the row count hits MaxRows. All errors are credential-redacted
// before being returned and audit log entries are emitted in both
// success and failure branches.
func (r *SafeQueryRunner) Execute(
	ctx context.Context,
	adapter ExecuteAdapter,
	sql string,
	params []interface{},
	opts QueryOptions,
) (*types.QueryResult, error) {
	if adapter == nil {
		return nil, fmt.Errorf("%w: nil adapter", types.ErrInvalidParam)
	}
	if err := Validate(sql, params, opts); err != nil {
		r.audit.Log(ctx, r.buildEntry(opts, sql, 0, 0, err))
		return nil, redactErr(err)
	}

	opts = applyDefaults(opts)
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	start := r.clock()
	result, err := adapter.ExecuteQuery(ctx, sql, params...)
	dur := r.clock().Sub(start)

	if err != nil {
		err = classifyCtxErr(ctx, err)
		r.audit.Log(ctx, r.buildEntry(opts, sql, dur, 0, err))
		return nil, redactErr(err)
	}

	truncated := false
	if result != nil && int64(len(result.Rows)) > opts.MaxRows {
		result.Rows = result.Rows[:opts.MaxRows]
		result.Count = opts.MaxRows
		truncated = true
	}
	if result != nil {
		// Truncated lives on the contract's amended QueryResult.
		// Current shape lacks it; mirror via Query field metadata.
		annotateTruncated(result, truncated)
	}
	r.audit.Log(ctx, r.buildEntry(opts, sql, dur, rowCount(result), nil))
	return result, nil
}

// buildEntry constructs an AuditEntry. Raw SQL is included only when
// opts.FullSQL is true; otherwise we store the sha256 hash so the
// audit table cannot leak PII embedded in user queries.
func (r *SafeQueryRunner) buildEntry(
	opts QueryOptions,
	sql string,
	dur time.Duration,
	rows int64,
	err error,
) AuditEntry {
	entry := AuditEntry{
		ConnectionID: opts.ConnectionID,
		UserID:       opts.UserID,
		QueryHash:    hashQuery(sql),
		DurationMs:   dur.Milliseconds(),
		RowCount:     rows,
		Timestamp:    r.clock(),
		ErrorClass:   classifyError(err),
	}
	if opts.FullSQL {
		entry.RawSQL = sql
	}
	return entry
}

