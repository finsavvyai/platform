package sql

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// rejectMultiStatement enforces single-statement queries — defence in depth
// even after we drop multiStatements=true from the DSN. Returns an
// errMySQLSyntax sentinel for any input containing an unescaped `;` that has
// non-whitespace content after it.
func rejectMultiStatement(query string) error {
	q := strings.TrimSpace(query)
	if q == "" {
		return (&types.AdapterError{Code: "EMPTY_QUERY", Message: "Query cannot be empty"}).
			WithSentinel(types.ErrInvalidParam)
	}
	// Allow a single optional trailing semicolon.
	trimmed := strings.TrimRight(q, "; \t\n\r")
	if strings.Contains(trimmed, ";") {
		// Naive scan — string-literal aware multi-statement detection is the
		// runner's job. Adapter just blocks the cheap form.
		return wrapMySQLAdapterErr("rejectMultiStatement", "MULTI_STATEMENT", "multiple statements not permitted", errMySQLSyntax)
	}
	return nil
}

// streamRows iterates *sql.Rows and pushes types.StreamRow values onto rowCh.
// The function:
//   - honours ctx.Done() (closes rows + emits ErrTimeout sentinel)
//   - hard-caps at opts.MaxRows (emits ErrMaxRows sentinel + closes)
//   - converts MySQL []byte to string and time.Time to RFC3339 for JSON parity
//     with ExecuteQuery
//
// Caller MUST close rowCh and errCh exactly once — this helper does NOT close
// channels (the public Stream wrapper owns the goroutine lifecycle).
func streamRows(ctx context.Context, rows *sql.Rows, opts types.StreamOptions, rowCh chan<- types.StreamRow) (terminal error) {
	columns, err := rows.Columns()
	if err != nil {
		return mapMySQLError(ctx, "rows.Columns", err)
	}

	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	var idx int64
	for rows.Next() {
		if err := ctx.Err(); err != nil {
			return mapMySQLError(ctx, "stream.ctx", err)
		}
		if idx >= opts.MaxRows {
			return wrapMySQLAdapterErr("stream.maxrows", "MAX_ROWS_EXCEEDED",
				"row limit reached", errMySQLMaxRows)
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return mapMySQLError(ctx, "rows.Scan", err)
		}

		out := make([]any, len(columns))
		for i := range columns {
			out[i] = normaliseMySQLValue(values[i])
		}

		select {
		case <-ctx.Done():
			return mapMySQLError(ctx, "stream.send", ctx.Err())
		case rowCh <- types.StreamRow{Columns: columns, Values: out, Index: idx}:
		}
		idx++
	}

	if err := rows.Err(); err != nil {
		return mapMySQLError(ctx, "rows.Err", err)
	}
	return nil
}

// normaliseMySQLValue mirrors the ExecuteQuery type-conversion contract: []byte
// → string, time.Time → RFC3339 string. All other types pass through.
func normaliseMySQLValue(v interface{}) interface{} {
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case []byte:
		return string(t)
	case time.Time:
		return t.Format(time.RFC3339)
	default:
		return v
	}
}
