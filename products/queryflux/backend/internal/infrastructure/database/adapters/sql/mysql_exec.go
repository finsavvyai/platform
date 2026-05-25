package sql

import (
	"context"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// ExecuteQuery runs a parameterized MySQL query. Multi-statement input is
// rejected (QUERY_CONTRACT.md §4); placeholders MUST be `?`.
func (m *MySQLAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.db == nil {
		return nil, wrapMySQLAdapterErr("MySQL.ExecuteQuery", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
	}
	query = strings.TrimSpace(query)
	if err := rejectMultiStatement(query); err != nil {
		return nil, err
	}

	rows, err := m.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, mapMySQLError(ctx, "MySQL.QueryContext", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, mapMySQLError(ctx, "MySQL.Columns", err)
	}
	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, mapMySQLError(ctx, "MySQL.ColumnTypes", err)
	}

	columnInfos := make([]types.ColumnInfo, len(columns))
	for i, colName := range columns {
		columnInfos[i] = types.ColumnInfo{Name: colName, Type: "unknown"}
		if i < len(colTypes) {
			columnInfos[i].Type = colTypes[i].DatabaseTypeName()
			if nullable, ok := colTypes[i].Nullable(); ok {
				columnInfos[i].Nullable = nullable
			}
		}
	}

	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	var resultRows []map[string]interface{}
	for rows.Next() {
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, mapMySQLError(ctx, "MySQL.Scan", err)
		}
		row := make(map[string]interface{}, len(columns))
		for i, col := range columns {
			row[col] = normaliseMySQLValueAtExec(values[i])
		}
		resultRows = append(resultRows, row)
	}
	if err := rows.Err(); err != nil {
		return nil, mapMySQLError(ctx, "MySQL.RowsErr", err)
	}

	return &types.QueryResult{
		Columns: columnInfos,
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// normaliseMySQLValueAtExec is the ExecuteQuery-flavoured value converter:
// []byte → string and time.Time → RFC3339 (matching the legacy adapter).
func normaliseMySQLValueAtExec(v interface{}) interface{} {
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
