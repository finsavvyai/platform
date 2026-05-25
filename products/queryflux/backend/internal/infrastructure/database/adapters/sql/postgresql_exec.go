package sql

import (
	"context"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// ExecuteQuery executes a parameterized PostgreSQL query and returns the full
// result set. All parameters are passed positionally to pgx ($1, $2, …) — the
// SQL string is treated as opaque user input and is NEVER concatenated.
//
// QUERY_CONTRACT.md safe-query rules enforced here:
//   - rule #1 (parameterized only) — params are forwarded as-is to pgx
//   - rule #1 extension (no multi-statement) — reject `;` mid-string
//   - rule #2 (ctx-driven timeout) — pgx honours ctx.Done()
func (p *PostgreSQLAdapter) ExecuteQuery(
	ctx context.Context,
	query string,
	params ...interface{},
) (*types.QueryResult, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.pool == nil {
		return nil, notConnectedError()
	}

	query = strings.TrimSpace(query)
	if query == "" {
		// Attach the canonical Phase-1 sentinel via WithSentinel so callers
		// can match with errors.Is(err, types.ErrInvalidParam). Stuffing it
		// into the Context map (the prior behaviour) bypassed errors.Is.
		ae := &types.AdapterError{Code: "EMPTY_QUERY", Message: "Query cannot be empty"}
		return nil, ae.WithSentinel(types.ErrInvalidParam)
	}
	if isMultiStatementSQL(query) {
		ae := &types.AdapterError{
			Code:    "MULTI_STATEMENT_REJECTED",
			Message: "Multi-statement SQL is not allowed",
		}
		return nil, ae.WithSentinel(types.ErrInvalidParam)
	}

	rows, err := p.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, pgAdapterError("QUERY_EXECUTION_FAILED",
			"Failed to execute query", ctx, err)
	}
	defer rows.Close()

	fds := rows.FieldDescriptions()
	columns := make([]types.ColumnInfo, len(fds))
	for i, fd := range fds {
		columns[i] = types.ColumnInfo{Name: string(fd.Name), Type: "unknown"}
	}

	resultRows := make([]map[string]interface{}, 0)
	for rows.Next() {
		values, verr := rows.Values()
		if verr != nil {
			return nil, pgAdapterError("ROW_SCAN_FAILED",
				"Failed to scan row", ctx, verr)
		}
		row := make(map[string]interface{}, len(columns))
		for i, col := range columns {
			row[col.Name] = values[i]
		}
		resultRows = append(resultRows, row)
	}
	if rerr := rows.Err(); rerr != nil {
		return nil, pgAdapterError("ROWS_ITERATION_FAILED",
			"Error during rows iteration", ctx, rerr)
	}

	return &types.QueryResult{
		Columns: columns,
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
		Success: true,
	}, nil
}
