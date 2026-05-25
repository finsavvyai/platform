package sql

import (
	"context"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Stream emits MariaDB rows over a buffered channel. Same semantics as the
// non-enhanced MariaDBAdapter.Stream (QUERY_CONTRACT.md §2).
func (a *MariaDBEnhancedAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	opts = opts.Normalize()
	rowCh := make(chan types.StreamRow, opts.BufferSize)
	errCh := make(chan error, 1)

	if a.db == nil {
		close(rowCh)
		errCh <- wrapMySQLAdapterErr("MariaDBEnhanced.Stream", "NOT_CONNECTED", "not connected to MariaDB", errMySQLNotConn)
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

	db := a.db
	go func() {
		defer close(rowCh)
		defer close(errCh)

		rows, err := db.QueryContext(ctx, query, params...)
		if err != nil {
			errCh <- mapMySQLError(ctx, "MariaDBEnhanced.Stream.Query", err)
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
