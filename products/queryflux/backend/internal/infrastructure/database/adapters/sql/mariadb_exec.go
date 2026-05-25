package sql

import (
	"context"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// ExecuteQuery runs a parameterized MariaDB query. Multi-statement input is
// rejected. Adapter applies MariaDB-flavoured syntax tweaks via
// adjustMariaDBSyntax before dispatching.
func (m *MariaDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.db == nil {
		return nil, wrapMySQLAdapterErr("MariaDB.ExecuteQuery", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
	}
	query = strings.TrimSpace(query)
	if err := rejectMultiStatement(query); err != nil {
		return nil, err
	}
	query = m.adjustMariaDBSyntax(query)

	rows, err := m.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDB.QueryContext", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDB.Columns", err)
	}
	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDB.ColumnTypes", err)
	}

	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	var resultRows []map[string]interface{}
	for rows.Next() {
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, mapMySQLError(ctx, "MariaDB.Scan", err)
		}
		row := make(map[string]interface{}, len(columns))
		for i, col := range columns {
			row[col] = normaliseMySQLValueAtExec(values[i])
		}
		resultRows = append(resultRows, row)
	}
	if err := rows.Err(); err != nil {
		return nil, mapMySQLError(ctx, "MariaDB.RowsErr", err)
	}

	columnInfos := make([]types.ColumnInfo, 0, len(columns))
	for i, name := range columns {
		ct := "UNKNOWN"
		if i < len(colTypes) {
			ct = colTypes[i].DatabaseTypeName()
		}
		columnInfos = append(columnInfos, types.ColumnInfo{Name: name, Type: ct})
	}

	return &types.QueryResult{
		Columns: columnInfos,
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// adjustMariaDBSyntax applies MariaDB-specific token swaps. JSON / window /
// CTE feature detection is reserved for future work — current logic only
// rewrites LIMIT/OFFSET ordering and leaves the rest untouched.
func (m *MariaDBAdapter) adjustMariaDBSyntax(query string) string {
	query = strings.ReplaceAll(query, "LIMIT ? OFFSET ?", "LIMIT ?, ?")
	return query
}
