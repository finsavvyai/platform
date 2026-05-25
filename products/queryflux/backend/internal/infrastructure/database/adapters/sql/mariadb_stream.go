package sql

import (
	"context"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Stream executes a SELECT against MariaDB and emits rows on a buffered
// channel. See QUERY_CONTRACT.md §2 and mysql_stream.go for the contract — the
// behaviours are identical (MariaDB uses the MySQL driver), but the receiver
// runs the MariaDB syntax tweaks before dispatch.
func (m *MariaDBAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	opts = opts.Normalize()
	rowCh := make(chan types.StreamRow, opts.BufferSize)
	errCh := make(chan error, 1)

	m.mutex.RLock()
	db := m.db
	m.mutex.RUnlock()

	if db == nil {
		close(rowCh)
		errCh <- wrapMySQLAdapterErr("MariaDB.Stream", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
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
	query = m.adjustMariaDBSyntax(query)

	go func() {
		defer close(rowCh)
		defer close(errCh)

		rows, err := db.QueryContext(ctx, query, params...)
		if err != nil {
			errCh <- mapMySQLError(ctx, "MariaDB.Stream.Query", err)
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
