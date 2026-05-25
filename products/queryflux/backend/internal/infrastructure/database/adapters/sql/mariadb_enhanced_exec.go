package sql

import (
	"context"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// ExecuteQuery runs a parameterised query against MariaDB. Multi-statement
// input is rejected even though the DSN never enables it.
func (a *MariaDBEnhancedAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.db == nil {
		return nil, wrapMySQLAdapterErr("MariaDBEnhanced.ExecuteQuery", "NOT_CONNECTED", "not connected to MariaDB", errMySQLNotConn)
	}
	query = strings.TrimSpace(query)
	if err := rejectMultiStatement(query); err != nil {
		return nil, err
	}

	startTime := time.Now()
	rows, err := a.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDBEnhanced.QueryContext", err)
	}
	defer rows.Close()

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDBEnhanced.ColumnTypes", err)
	}
	columns, err := rows.Columns()
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDBEnhanced.Columns", err)
	}

	if len(columns) == 0 {
		return &types.QueryResult{
			Columns: []types.ColumnInfo{},
			Rows:    []map[string]interface{}{},
			Count:   0,
		}, nil
	}

	columnInfos := make([]types.ColumnInfo, 0, len(columns))
	for i, name := range columns {
		ct := "UNKNOWN"
		if i < len(colTypes) {
			ct = colTypes[i].DatabaseTypeName()
		}
		columnInfos = append(columnInfos, types.ColumnInfo{Name: name, Type: ct})
	}

	results, err := scanMariaDBEnhancedRows(ctx, rows, columns)
	if err != nil {
		return nil, err
	}

	a.logger.WithFields(logrus.Fields{
		"query":    truncateQuery(query, 50),
		"rows":     len(results),
		"columns":  len(columns),
		"duration": time.Since(startTime).Milliseconds(),
	}).Debug("MariaDB query executed")

	return &types.QueryResult{
		Columns: columnInfos,
		Rows:    results,
		Count:   int64(len(results)),
	}, nil
}

// scanMariaDBEnhancedRows iterates *sql.Rows into the legacy []map[string]any
// shape used by the rest of the codebase (QUERY_CONTRACT.md §2 note).
func scanMariaDBEnhancedRows(ctx context.Context, rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}, columns []string) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range columns {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, mapMySQLError(ctx, "MariaDBEnhanced.Scan", err)
		}
		row := make(map[string]interface{}, len(columns))
		for i, col := range columns {
			row[col] = values[i]
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, mapMySQLError(ctx, "MariaDBEnhanced.RowsErr", err)
	}
	return results, nil
}
