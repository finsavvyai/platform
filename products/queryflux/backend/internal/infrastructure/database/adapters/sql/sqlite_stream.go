package sql

import (
	"context"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Stream executes `query` and pushes rows down `out`. It honours ctx
// cancellation, opts.MaxRows, and the safe-query contract (positional `?`
// params only, single statement). Closes both channels on completion.
//
// Contract (QUERY_CONTRACT.md §2):
//   - out closes when the result set is drained, MaxRows is hit, or ctx is done.
//   - errCh emits exactly one terminal error (nil on success) then closes.
func (s *SQLiteAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	opts = opts.Normalize()
	if opts.BufferSize < 256 {
		opts.BufferSize = 256 // contract: buffered channel (256)
	}
	out := make(chan types.StreamRow, opts.BufferSize)
	errCh := make(chan error, 1)

	go s.streamRun(ctx, strings.TrimSpace(query), opts, params, out, errCh)
	return out, errCh
}

func (s *SQLiteAdapter) streamRun(ctx context.Context, query string, opts types.StreamOptions, params []interface{}, out chan<- types.StreamRow, errCh chan<- error) {
	defer close(out)
	defer close(errCh)

	s.mutex.RLock()
	db := s.db
	s.mutex.RUnlock()

	if db == nil {
		errCh <- notConnected()
		return
	}
	if query == "" {
		errCh <- (&types.AdapterError{Code: "EMPTY_QUERY", Message: "Query cannot be empty"}).
			WithSentinel(types.ErrInvalidParam)
		return
	}
	if isMultiStatement(query) {
		errCh <- (&types.AdapterError{
			Code:    "MULTI_STATEMENT_REJECTED",
			Message: "Multiple statements are not allowed",
		}).WithSentinel(types.ErrSyntax)
		return
	}

	rows, err := db.QueryContext(ctx, query, params...)
	if err != nil {
		errCh <- wrapStreamErr("STREAM_QUERY_FAILED", err, mapSQLiteCtxError(ctx, err))
		return
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		errCh <- wrapStreamErr("STREAM_COLUMNS_FAILED", err, types.ErrConnection)
		return
	}

	values := make([]interface{}, len(columns))
	ptrs := make([]interface{}, len(columns))
	for i := range values {
		ptrs[i] = &values[i]
	}

	var idx int64
	for rows.Next() {
		// Honour cancellation between rows.
		select {
		case <-ctx.Done():
			errCh <- (&types.AdapterError{
				Code:    "STREAM_CANCELLED",
				Message: "Stream cancelled",
				Details: ctx.Err().Error(),
			}).WithSentinel(mapSQLiteCtxError(ctx, ctx.Err()))
			return
		default:
		}

		if err := rows.Scan(ptrs...); err != nil {
			errCh <- wrapStreamErr("STREAM_SCAN_FAILED", err, types.ErrConnection)
			return
		}

		row := types.StreamRow{
			Columns: columns,
			Values:  copyValues(values),
			Index:   idx,
		}

		select {
		case out <- row:
		case <-ctx.Done():
			errCh <- (&types.AdapterError{
				Code:    "STREAM_CANCELLED",
				Message: "Stream cancelled while sending",
				Details: ctx.Err().Error(),
			}).WithSentinel(mapSQLiteCtxError(ctx, ctx.Err()))
			return
		}

		idx++
		if idx >= opts.MaxRows {
			errCh <- (&types.AdapterError{
				Code:    "MAX_ROWS_EXCEEDED",
				Message: "Stream stopped at MaxRows",
			}).WithSentinel(types.ErrMaxRows)
			return
		}
	}
	if err := rows.Err(); err != nil {
		errCh <- wrapStreamErr("STREAM_ITERATION_FAILED", err, mapSQLiteCtxError(ctx, err))
		return
	}
	errCh <- nil
}

func copyValues(in []interface{}) []interface{} {
	out := make([]interface{}, len(in))
	for i, v := range in {
		switch t := v.(type) {
		case []byte:
			// Defensive copy: driver may reuse the buffer between Scan calls.
			b := make([]byte, len(t))
			copy(b, t)
			out[i] = string(b)
		default:
			out[i] = v
		}
	}
	return out
}

func wrapStreamErr(code string, err error, sentinel error) *types.AdapterError {
	return (&types.AdapterError{
		Code:    code,
		Message: "Stream error",
		Details: err.Error(),
	}).WithSentinel(sentinel)
}
