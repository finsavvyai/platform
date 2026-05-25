package query

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Chunk is a page of rows emitted by the streaming runner. Columns
// is populated on the first chunk only; downstream consumers should
// reuse the column order for subsequent chunks.
type Chunk struct {
	Columns []string
	Rows    [][]interface{}
	Index   int64 // page index, starting at 0
	Final   bool  // true on the last (possibly empty) chunk
}

// Stream wraps adapter.Stream with timeout, max-row, validation and
// audit policy. The returned chunk channel closes on completion or
// cancellation; the error channel emits exactly one terminal value
// (nil on success) then closes. Cancellation propagates through the
// supplied parent context.
func (r *SafeQueryRunner) Stream(
	parent context.Context,
	adapter StreamAdapter,
	sql string,
	params []interface{},
	opts QueryOptions,
) (<-chan Chunk, <-chan error) {
	chunks := make(chan Chunk, DefaultChanBuffer)
	errs := make(chan error, 1)

	if adapter == nil {
		errs <- fmt.Errorf("%w: nil adapter", types.ErrInvalidParam)
		close(chunks)
		close(errs)
		return chunks, errs
	}
	if err := Validate(sql, params, opts); err != nil {
		r.audit.Log(parent, r.buildEntry(opts, sql, 0, 0, err))
		errs <- redactErr(err)
		close(chunks)
		close(errs)
		return chunks, errs
	}

	opts = applyDefaults(opts)
	ctx, cancel := WithTimeout(parent, opts.Timeout)

	rowCh, srcErrCh := adapter.Stream(ctx, sql, params...)
	go r.pump(ctx, cancel, sql, opts, rowCh, srcErrCh, chunks, errs)
	return chunks, errs
}

// pump consumes the adapter row channel, batches rows into Chunks
// of opts.BatchSize, enforces the MaxRows hard stop across chunks
// and forwards the terminal error.
func (r *SafeQueryRunner) pump(
	ctx context.Context,
	cancel context.CancelFunc,
	sql string,
	opts QueryOptions,
	rowCh <-chan StreamRow,
	srcErrCh <-chan error,
	chunks chan<- Chunk,
	errs chan<- error,
) {
	defer cancel()
	defer close(chunks)
	defer close(errs)

	start := time.Now()
	st := newPumpState(opts)
	var finalErr error

loop:
	for {
		select {
		case <-ctx.Done():
			finalErr = classifyCtxErr(ctx, ctx.Err())
			break loop
		case row, ok := <-rowCh:
			if !ok {
				break loop
			}
			if r.handleRow(ctx, row, st, chunks) {
				finalErr = fmt.Errorf("%w: row cap %d reached", types.ErrMaxRows, opts.MaxRows)
				break loop
			}
		case err := <-srcErrCh:
			finalErr = err
			break loop
		}
	}

	r.flushFinal(ctx, st, chunks, finalErr)
	r.audit.Log(ctx, r.buildEntry(opts, sql, time.Since(start), st.total, finalErr))
	if finalErr != nil {
		errs <- redactErr(finalErr)
		return
	}
	errs <- nil
}

// handleRow appends a single row to the current batch, flushes when
// the batch fills, and returns true when the MaxRows hard cap is hit.
func (r *SafeQueryRunner) handleRow(
	ctx context.Context,
	row StreamRow,
	st *pumpState,
	chunks chan<- Chunk,
) bool {
	if st.columns == nil && len(row.Columns) > 0 {
		st.columns = row.Columns
	}
	if st.total >= st.maxRows {
		return true
	}
	st.batch = append(st.batch, row.Values)
	st.total++
	if len(st.batch) >= st.batchSize {
		r.emitChunk(ctx, st, chunks, false)
	}
	return st.total >= st.maxRows
}

// flushFinal pushes any tail batch and a terminal Chunk with Final=true.
// On error we still emit the trailing rows so downstream consumers can
// surface partial results.
func (r *SafeQueryRunner) flushFinal(
	ctx context.Context,
	st *pumpState,
	chunks chan<- Chunk,
	_ error,
) {
	if len(st.batch) > 0 {
		r.emitChunk(ctx, st, chunks, true)
		return
	}
	r.safeSend(ctx, chunks, Chunk{
		Columns: st.columns,
		Index:   st.pageIdx,
		Final:   true,
	})
}

// emitChunk ships the current batch downstream, resets the slice and
// bumps the page index. Sending respects ctx cancellation so a slow
// consumer cannot deadlock the pump.
func (r *SafeQueryRunner) emitChunk(
	ctx context.Context,
	st *pumpState,
	chunks chan<- Chunk,
	final bool,
) {
	chunk := Chunk{
		Columns: st.columns,
		Rows:    st.batch,
		Index:   st.pageIdx,
		Final:   final,
	}
	st.batch = make([][]interface{}, 0, st.batchSize)
	st.pageIdx++
	r.safeSend(ctx, chunks, chunk)
}

// safeSend writes to chunks unless ctx is already cancelled. We never
// block forever — cancellation cuts the goroutine free.
func (r *SafeQueryRunner) safeSend(ctx context.Context, chunks chan<- Chunk, c Chunk) {
	select {
	case <-ctx.Done():
	case chunks <- c:
	}
}

// pumpState carries the streaming loop's mutable bookkeeping.
type pumpState struct {
	columns   []string
	batch     [][]interface{}
	total     int64
	pageIdx   int64
	batchSize int
	maxRows   int64
}

func newPumpState(opts QueryOptions) *pumpState {
	return &pumpState{
		batch:     make([][]interface{}, 0, opts.BatchSize),
		batchSize: opts.BatchSize,
		maxRows:   opts.MaxRows,
	}
}
