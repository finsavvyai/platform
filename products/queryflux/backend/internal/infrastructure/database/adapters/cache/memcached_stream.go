package cache

import (
	"context"
	"fmt"

	"github.com/bradfitz/gomemcache/memcache"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Stream walks a set of pre-supplied keys (passed as params) using gomemcache
// GetMulti in chunks of BatchSize.
//
// LIMITATION: Memcached's text/binary protocol does not expose a server-side
// cursor for iterating the keyspace. The binary stats-cachedump op is
// implementation-specific and not exposed by gomemcache. Stream therefore
// requires the caller to provide the key set; for full-keyspace scans the
// caller must enumerate keys via an external index (e.g. a Redis sidecar set
// or application-managed key registry).
//
// Phase 1 contract (QUERY_CONTRACT.md §2): uses canonical types.StreamOptions
// and types.StreamRow.
//
// Usage:
//
//	rows, errCh := adapter.Stream(ctx, "GETMULTI", opts, "k1", "k2", "k3", ...)
func (m *MemcachedAdapter) Stream(
	ctx context.Context,
	query string,
	opts types.StreamOptions,
	params ...interface{},
) (<-chan types.StreamRow, <-chan error) {
	opts = opts.Normalize()
	rows := make(chan types.StreamRow, opts.BufferSize)
	errCh := make(chan error, 1)

	go m.runStream(ctx, query, opts, params, rows, errCh)
	return rows, errCh
}

func (m *MemcachedAdapter) runStream(
	ctx context.Context,
	query string,
	opts types.StreamOptions,
	params []interface{},
	rows chan<- types.StreamRow,
	errCh chan<- error,
) {
	defer close(rows)
	defer close(errCh)

	m.mutex.RLock()
	client := m.client
	m.mutex.RUnlock()
	if client == nil {
		errCh <- errMcNotConnected
		return
	}

	keys := paramsToKeys(params)
	if len(keys) == 0 {
		errCh <- memcachedAdapterError("STREAM_NO_KEYS",
			"Memcached Stream requires a key list via params (no server-side cursor available)",
			ctx, errMcInvalidParam)
		return
	}

	columns := []string{"key", "value", "flags", "found"}
	var emitted int64
	batch := opts.BatchSize
	if batch <= 0 {
		batch = 256
	}

	for chunk := range chunkedKeys(keys, batch) {
		select {
		case <-ctx.Done():
			errCh <- classifyMemcachedError(ctx, ctx.Err())
			return
		default:
		}

		items, err := client.GetMulti(chunk)
		if err != nil {
			errCh <- memcachedAdapterError("GETMULTI_FAILED",
				"GetMulti failed during stream", ctx, err)
			return
		}
		for _, k := range chunk {
			if emitted >= opts.MaxRows {
				errCh <- errMcMaxRows
				return
			}
			row := buildStreamRow(columns, k, items[k], emitted)
			select {
			case rows <- row:
				emitted++
			case <-ctx.Done():
				errCh <- classifyMemcachedError(ctx, ctx.Err())
				return
			}
		}
	}
	errCh <- nil
}

// paramsToKeys flattens variadic params into a deduped string slice.
func paramsToKeys(params []interface{}) []string {
	seen := make(map[string]struct{}, len(params))
	out := make([]string, 0, len(params))
	for _, p := range params {
		k := fmt.Sprintf("%v", p)
		if k == "" {
			continue
		}
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = struct{}{}
		out = append(out, k)
	}
	return out
}

// chunkedKeys yields slices of size n over keys via a channel.
func chunkedKeys(keys []string, n int) <-chan []string {
	out := make(chan []string)
	go func() {
		defer close(out)
		for i := 0; i < len(keys); i += n {
			end := i + n
			if end > len(keys) {
				end = len(keys)
			}
			out <- keys[i:end]
		}
	}()
	return out
}

// buildStreamRow constructs a row from a GetMulti hit-or-miss.
func buildStreamRow(columns []string, key string, item *memcache.Item, idx int64) types.StreamRow {
	if item == nil {
		return types.StreamRow{
			Columns: columns,
			Values:  []any{key, nil, uint32(0), false},
			Index:   idx,
		}
	}
	return types.StreamRow{
		Columns: columns,
		Values:  []any{key, string(item.Value), item.Flags, true},
		Index:   idx,
	}
}
