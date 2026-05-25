package nosql

import (
	"context"
	"fmt"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Stream executes a query and pushes rows through a buffered channel as the
// mongo cursor yields them. The errCh emits exactly one terminal error
// (nil on success) then closes. Honours ctx cancellation: the cursor is
// closed and the channels are drained-then-closed.
//
// Phase 1 contract (QUERY_CONTRACT.md §2): uses canonical types.StreamOptions
// and types.StreamRow.
func (m *MongoDBAdapter) Stream(
	ctx context.Context,
	query string,
	opts types.StreamOptions,
	params ...interface{},
) (<-chan types.StreamRow, <-chan error) {
	opts = opts.Normalize()
	rowCh := make(chan types.StreamRow, opts.BufferSize)
	errCh := make(chan error, 1)

	go m.runStream(ctx, query, opts, rowCh, errCh)
	return rowCh, errCh
}

func (m *MongoDBAdapter) runStream(
	ctx context.Context,
	query string,
	opts types.StreamOptions,
	rowCh chan<- types.StreamRow,
	errCh chan<- error,
) {
	defer close(rowCh)
	defer close(errCh)

	m.mutex.RLock()
	if m.client == nil || m.database == nil {
		m.mutex.RUnlock()
		errCh <- ErrNotConnected
		return
	}
	m.mutex.RUnlock()

	op, err := m.parseMongoOperation(query)
	if err != nil {
		errCh <- fmt.Errorf("parse: %w", ErrSyntax)
		return
	}
	if op.Type != "find" && op.Type != "aggregate" {
		errCh <- fmt.Errorf("stream supports only find/aggregate, got %q: %w", op.Type, ErrInvalidParam)
		return
	}

	cursor, err := m.openStreamCursor(ctx, op, opts)
	if err != nil {
		errCh <- m.wrapStreamErr(err)
		return
	}
	defer cursor.Close(ctx)

	m.pumpCursor(ctx, cursor, opts, rowCh, errCh)
}

// openStreamCursor opens a find/aggregate cursor with batch-size hint.
func (m *MongoDBAdapter) openStreamCursor(ctx context.Context, op *MongoOperation, opts types.StreamOptions) (*mongo.Cursor, error) {
	coll := m.database.Collection(op.Collection)
	batch := int32(opts.BatchSize)

	if op.Type == "find" {
		filter := op.Filter
		if filter == nil {
			filter = bson.M{}
		}
		findOpts := options.Find().SetBatchSize(batch).SetLimit(opts.MaxRows)
		return coll.Find(ctx, filter, findOpts)
	}
	// aggregate
	pipeline := op.Pipeline
	if pipeline == nil {
		pipeline = []bson.M{}
	}
	aggOpts := options.Aggregate().SetBatchSize(batch)
	return coll.Aggregate(ctx, pipeline, aggOpts)
}

// pumpCursor drains the cursor into rowCh until ctx cancel, MaxRows hit, or
// cursor exhaustion. Emits a single terminal value on errCh.
func (m *MongoDBAdapter) pumpCursor(
	ctx context.Context,
	cursor *mongo.Cursor,
	opts types.StreamOptions,
	rowCh chan<- types.StreamRow,
	errCh chan<- error,
) {
	var columns []string
	var idx int64
	for cursor.Next(ctx) {
		if ctx.Err() != nil {
			errCh <- ctx.Err()
			return
		}
		if idx >= opts.MaxRows {
			errCh <- ErrMaxRows
			return
		}
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			errCh <- m.wrapStreamErr(err)
			return
		}
		row := m.docToStreamRow(doc, &columns, idx)
		select {
		case <-ctx.Done():
			errCh <- ctx.Err()
			return
		case rowCh <- row:
		}
		idx++
	}
	if err := cursor.Err(); err != nil {
		errCh <- m.wrapStreamErr(err)
		return
	}
	errCh <- nil
}

// docToStreamRow flattens a bson.M into ordered Values matching *columns.
// On the first row it seeds *columns from the document keys.
func (m *MongoDBAdapter) docToStreamRow(doc bson.M, columns *[]string, idx int64) types.StreamRow {
	if *columns == nil {
		// First row sets the column order.
		cols := make([]string, 0, len(doc))
		for k := range doc {
			cols = append(cols, k)
		}
		*columns = cols
	}
	values := make([]interface{}, len(*columns))
	for i, c := range *columns {
		values[i] = m.convertBSONValue(doc[c])
	}
	return types.StreamRow{Columns: *columns, Values: values, Index: idx}
}

// wrapStreamErr maps a driver error to a sentinel-wrapped error.
func (m *MongoDBAdapter) wrapStreamErr(err error) error {
	if s := classifyMongoErr(err); s != nil {
		return fmt.Errorf("%s: %w", err.Error(), s)
	}
	return err
}
