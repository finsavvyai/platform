package cache

import (
	"context"
	"fmt"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*RedisAdapter)(nil)

// Stream enumerates Redis keys via a SCAN cursor iterator (bounded memory).
// SCAN/KEYS commands walk the keyspace; other allowlisted commands delegate to
// ExecuteQuery and stream the resulting rows. Honours ctx cancel + MaxRows.
//
// Phase 1 contract (QUERY_CONTRACT.md §2): uses canonical types.StreamOptions
// and types.StreamRow.
func (r *RedisAdapter) Stream(
	ctx context.Context,
	query string,
	opts types.StreamOptions,
	params ...interface{},
) (<-chan types.StreamRow, <-chan error) {
	opts = opts.Normalize()
	rows := make(chan types.StreamRow, opts.BufferSize)
	errCh := make(chan error, 1)

	go r.runStream(ctx, query, opts, params, rows, errCh)
	return rows, errCh
}

// runStream is the goroutine body — always closes both channels and emits one
// terminal error (nil on success).
func (r *RedisAdapter) runStream(
	ctx context.Context,
	query string,
	opts types.StreamOptions,
	params []interface{},
	rows chan<- types.StreamRow,
	errCh chan<- error,
) {
	defer close(rows)
	defer close(errCh)

	r.mutex.RLock()
	client := r.client
	r.mutex.RUnlock()
	if client == nil {
		errCh <- errRedisNotConnected
		return
	}

	cmd, err := r.parseRedisCommand(query, params...)
	if err != nil {
		errCh <- redisAdapterError("COMMAND_PARSE_FAILED", "Failed to parse Redis command", ctx, err)
		return
	}
	if !isCommandAllowed(cmd.Name) {
		errCh <- redisAdapterError("COMMAND_NOT_ALLOWED",
			fmt.Sprintf("Command %s rejected: not in allowlist (Lua / scripting blocked)", cmd.Name),
			ctx, errRedisPermission)
		return
	}

	switch cmd.Name {
	case "SCAN", "KEYS":
		pattern := "*"
		if len(cmd.Args) > 0 {
			pattern = fmt.Sprintf("%v", cmd.Args[0])
		}
		r.streamScan(ctx, pattern, opts, rows, errCh)
	default:
		r.streamFallback(ctx, cmd, opts, rows, errCh)
	}
}

// streamScan walks the Redis keyspace via SCAN cursor — bounded memory, honours
// ctx cancel + MaxRows + BatchSize (SCAN COUNT hint).
func (r *RedisAdapter) streamScan(
	ctx context.Context,
	pattern string,
	opts types.StreamOptions,
	rows chan<- types.StreamRow,
	errCh chan<- error,
) {
	columns := []string{"key", "type", "ttl_seconds"}
	cursor := uint64(0)
	var emitted int64

	for {
		select {
		case <-ctx.Done():
			errCh <- classifyRedisError(ctx, ctx.Err())
			return
		default:
		}

		keys, next, err := r.client.Scan(ctx, cursor, pattern, int64(opts.BatchSize)).Result()
		if err != nil {
			errCh <- redisAdapterError("SCAN_FAILED", "SCAN iterator failed", ctx, err)
			return
		}
		for _, key := range keys {
			if emitted >= opts.MaxRows {
				errCh <- errRedisMaxRows
				return
			}
			keyType, _ := r.client.Type(ctx, key).Result()
			ttl, _ := r.client.TTL(ctx, key).Result()
			row := types.StreamRow{
				Columns: columns,
				Values:  []any{key, keyType, int64(ttl.Seconds())},
				Index:   emitted,
			}
			select {
			case rows <- row:
				emitted++
			case <-ctx.Done():
				errCh <- classifyRedisError(ctx, ctx.Err())
				return
			}
		}
		if next == 0 {
			errCh <- nil
			return
		}
		cursor = next
	}
}

// streamFallback handles non-SCAN commands by executing once and streaming the
// resulting QueryResult rows. Bounded by opts.MaxRows.
func (r *RedisAdapter) streamFallback(
	ctx context.Context,
	cmd *RedisCommand,
	opts types.StreamOptions,
	rows chan<- types.StreamRow,
	errCh chan<- error,
) {
	result, err := r.executeRedisCommand(ctx, cmd)
	if err != nil {
		errCh <- redisAdapterError("EXEC_FAILED", "Redis command execution failed", ctx, err)
		return
	}
	columns := make([]string, len(result.Columns))
	for i, c := range result.Columns {
		columns[i] = c.Name
	}
	for i, row := range result.Rows {
		if int64(i) >= opts.MaxRows {
			errCh <- errRedisMaxRows
			return
		}
		values := make([]any, len(columns))
		for j, col := range columns {
			values[j] = row[col]
		}
		select {
		case rows <- types.StreamRow{Columns: columns, Values: values, Index: int64(i)}:
		case <-ctx.Done():
			errCh <- classifyRedisError(ctx, ctx.Err())
			return
		}
	}
	errCh <- nil
}
