package sql

import (
	"context"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Stream executes a SELECT against MySQL and emits rows on a buffered channel.
// Phase 1 contract (QUERY_CONTRACT.md §2):
//   - rowCh closes when the result set is drained or ctx is cancelled
//   - errCh emits exactly one terminal error (nil on success) then closes
//   - ctx cancellation closes *sql.Rows
//   - opts.MaxRows is hard-capped (default 10000)
//   - opts.BufferSize defaults to 64 via types.StreamOptions.Normalize()
func (m *MySQLAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	opts = opts.Normalize()
	rowCh := make(chan types.StreamRow, opts.BufferSize)
	errCh := make(chan error, 1)

	m.mutex.RLock()
	db := m.db
	m.mutex.RUnlock()

	if db == nil {
		close(rowCh)
		errCh <- wrapMySQLAdapterErr("MySQL.Stream", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
		close(errCh)
		return rowCh, errCh
	}

	query = strings.TrimSpace(query)
	if err := rejectMultiStatement(query); err != nil {
		close(rowCh)
		errCh <- err
		close(errCh)
		return rowCh, errCh
	}

	go func() {
		defer close(rowCh)
		defer close(errCh)

		rows, err := db.QueryContext(ctx, query, params...)
		if err != nil {
			errCh <- mapMySQLError(ctx, "MySQL.Stream.Query", err)
			return
		}
		defer rows.Close()

		if terminal := streamRows(ctx, rows, opts, rowCh); terminal != nil {
			errCh <- terminal
			return
		}
		errCh <- nil
	}()

	return rowCh, errCh
}
