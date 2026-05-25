package sql

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// ExecuteQuery runs a single SQLite statement with positional `?` parameters.
// Multi-statement input is rejected to keep the safe-query contract simple.
func (s *SQLiteAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.db == nil {
		return nil, notConnected()
	}

	query = strings.TrimSpace(query)
	if query == "" {
		return nil, (&types.AdapterError{
			Code:    "EMPTY_QUERY",
			Message: "Query cannot be empty",
		}).WithSentinel(types.ErrInvalidParam)
	}
	if isMultiStatement(query) {
		return nil, (&types.AdapterError{
			Code:    "MULTI_STATEMENT_REJECTED",
			Message: "Multiple statements are not allowed",
		}).WithSentinel(types.ErrSyntax)
	}

	start := time.Now()
	if s.base != nil {
		start = s.base.TrackQueryStart(query)
	}

	rows, err := s.db.QueryContext(ctx, query, params...)
	if s.base != nil {
		s.base.TrackQueryEnd(start, err == nil, err)
	}
	if err != nil {
		return nil, s.base.CreateError("QUERY_EXECUTION_FAILED",
			"Failed to execute query", err.Error(), query, params...).
			WithSentinel(mapSQLiteCtxError(ctx, err))
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, wrapScan("COLUMN_INFO_FAILED", "Failed to get column information", err)
	}
	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, wrapScan("COLUMN_TYPE_FAILED", "Failed to get column type information", err)
	}

	colInfos := buildColumnInfos(columns, colTypes)

	values := make([]interface{}, len(columns))
	ptrs := make([]interface{}, len(columns))
	for i := range values {
		ptrs[i] = &values[i]
	}

	resultRows := make([]map[string]interface{}, 0, 64)
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			return nil, wrapScan("ROW_SCAN_FAILED", "Failed to scan row", err)
		}
		resultRows = append(resultRows, normalizeRow(columns, values))
	}
	if err := rows.Err(); err != nil {
		return nil, wrapScan("ROWS_ITERATION_FAILED", "Error during rows iteration", err).
			WithSentinel(mapSQLiteCtxError(ctx, err))
	}

	return &types.QueryResult{
		Columns:       colInfos,
		Rows:          resultRows,
		Count:         int64(len(resultRows)),
		ExecutionTime: time.Since(start).Milliseconds(),
		Success:       true,
	}, nil
}

func buildColumnInfos(columns []string, colTypes []*sql.ColumnType) []types.ColumnInfo {
	out := make([]types.ColumnInfo, len(columns))
	for i, c := range columns {
		t := "unknown"
		if i < len(colTypes) && colTypes[i] != nil {
			t = colTypes[i].DatabaseTypeName()
		}
		out[i] = types.ColumnInfo{Name: c, Type: t, Nullable: true}
	}
	return out
}

func normalizeRow(columns []string, values []interface{}) map[string]interface{} {
	row := make(map[string]interface{}, len(columns))
	for i, col := range columns {
		val := values[i]
		if val == nil {
			row[col] = nil
			continue
		}
		switch v := val.(type) {
		case []byte:
			row[col] = string(v)
		case time.Time:
			row[col] = v.Format(time.RFC3339)
		default:
			row[col] = v
		}
	}
	return row
}

func wrapScan(code, msg string, err error) *types.AdapterError {
	return (&types.AdapterError{
		Code:    code,
		Message: msg,
		Details: err.Error(),
	}).WithSentinel(types.ErrConnection)
}

// isMultiStatement returns true if `query` contains a `;` followed by any
// non-whitespace, non-comment characters. Trailing semicolons are fine.
func isMultiStatement(query string) bool {
	trimmed := strings.TrimRight(query, "; \t\r\n")
	return strings.ContainsRune(trimmed, ';')
}
