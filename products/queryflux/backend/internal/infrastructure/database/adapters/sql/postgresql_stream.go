package sql

import (
	"context"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Stream executes a parameterized query and pushes each row as a
// types.StreamRow through a buffered channel. The error channel emits at most
// one terminal error (nil on success) and then closes. Stream honours ctx
// cancellation and closes pgx.Rows promptly on context.Done().
//
// Phase 1 contract (QUERY_CONTRACT.md §2):
//   - rowsCh closes when result set drained, MaxRows hit, or ctx cancelled
//   - errCh emits exactly one terminal error then closes
//   - opts.MaxRows / opts.BufferSize defaults applied via Normalize()
func (p *PostgreSQLAdapter) Stream(
	ctx context.Context,
	query string,
	opts types.StreamOptions,
	params ...interface{},
) (<-chan types.StreamRow, <-chan error) {
	opts = opts.Normalize()
	rowsCh := make(chan types.StreamRow, opts.BufferSize)
	errCh := make(chan error, 1)

	go p.runStream(ctx, strings.TrimSpace(query), opts, params, rowsCh, errCh)
	return rowsCh, errCh
}

func (p *PostgreSQLAdapter) runStream(
	ctx context.Context,
	query string,
	opts types.StreamOptions,
	params []interface{},
	rowsCh chan<- types.StreamRow,
	errCh chan<- error,
) {
	defer close(rowsCh)
	defer close(errCh)

	p.mutex.RLock()
	pool := p.pool
	p.mutex.RUnlock()
	if pool == nil {
		errCh <- notConnectedError()
		return
	}

	if query == "" {
		errCh <- invalidStreamQueryErr("Stream query is empty")
		return
	}
	if isMultiStatementSQL(query) {
		errCh <- invalidStreamQueryErr("Stream query contains multiple statements")
		return
	}

	rows, err := pool.Query(ctx, query, params...)
	if err != nil {
		errCh <- pgAdapterError("STREAM_QUERY_FAILED",
			"Failed to start streaming query", ctx, err)
		return
	}
	defer rows.Close()

	fds := rows.FieldDescriptions()
	colNames := make([]string, len(fds))
	for i, fd := range fds {
		colNames[i] = string(fd.Name)
	}

	var idx int64
	for rows.Next() {
		if cerr := ctx.Err(); cerr != nil {
			errCh <- pgAdapterError("STREAM_CANCELLED",
				"Stream cancelled by context", ctx, cerr)
			return
		}
		if idx >= opts.MaxRows {
			errCh <- (&types.AdapterError{
				Code:    "MAX_ROWS_EXCEEDED",
				Message: "Stream stopped at MaxRows",
			}).WithSentinel(types.ErrMaxRows)
			return
		}
		values, verr := rows.Values()
		if verr != nil {
			errCh <- pgAdapterError("STREAM_ROW_SCAN_FAILED",
				"Failed to scan streamed row", ctx, verr)
			return
		}
		row := types.StreamRow{
			Columns: colNames,
			Values:  values,
			Index:   idx,
		}
		select {
		case rowsCh <- row:
		case <-ctx.Done():
			errCh <- pgAdapterError("STREAM_CANCELLED",
				"Stream cancelled by context", ctx, ctx.Err())
			return
		}
		idx++
	}
	if rerr := rows.Err(); rerr != nil {
		errCh <- pgAdapterError("STREAM_ITERATION_FAILED",
			"Error during stream iteration", ctx, rerr)
		return
	}
	errCh <- nil
}

// invalidStreamQueryErr builds the pre-flight rejection error for Stream.
// Uses the canonical WithSentinel attach (no Context-map sentinel kludge).
func invalidStreamQueryErr(reason string) *types.AdapterError {
	return (&types.AdapterError{
		Code:    "INVALID_STREAM_QUERY",
		Message: reason,
	}).WithSentinel(types.ErrInvalidParam)
}
