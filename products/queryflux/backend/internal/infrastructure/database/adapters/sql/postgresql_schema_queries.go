package sql

import (
	"context"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// queryColumns returns column metadata for schema.table using a parameterised
// information_schema query. Primary-key flag is derived from
// table_constraints + key_column_usage.
func (p *PostgreSQLAdapter) queryColumns(ctx context.Context, schema, table string) ([]types.ColumnInfo, error) {
	const q = `
		SELECT
			c.column_name,
			c.data_type,
			c.is_nullable,
			c.column_default,
			CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
		FROM information_schema.columns c
		LEFT JOIN (
			SELECT ku.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage ku
			  ON tc.constraint_name = ku.constraint_name
			 AND tc.table_schema = ku.table_schema
			WHERE tc.constraint_type = 'PRIMARY KEY'
			  AND tc.table_schema = $1
			  AND tc.table_name = $2
		) pk ON c.column_name = pk.column_name
		WHERE c.table_schema = $1 AND c.table_name = $2
		ORDER BY c.ordinal_position
	`
	rows, err := p.pool.Query(ctx, q, schema, table)
	if err != nil {
		return nil, pgAdapterError("TABLE_COLUMN_QUERY_FAILED",
			"Failed to query table columns", ctx, err)
	}
	defer rows.Close()

	cols := make([]types.ColumnInfo, 0)
	for rows.Next() {
		var col types.ColumnInfo
		var nullable string
		var defVal *string
		if err := rows.Scan(&col.Name, &col.Type, &nullable, &defVal, &col.IsPrimaryKey); err != nil {
			return nil, pgAdapterError("COLUMN_SCAN_FAILED",
				"Failed to scan column information", ctx, err)
		}
		col.Nullable = nullable == "YES"
		if defVal != nil {
			col.DefaultValue = *defVal
		}
		cols = append(cols, col)
	}
	return cols, nil
}

// queryIndexes returns index metadata for schema.table from pg_indexes.
// Column list is extracted from the indexdef text (simplified parser).
func (p *PostgreSQLAdapter) queryIndexes(ctx context.Context, schema, table string) ([]types.IndexInfo, error) {
	const q = `
		SELECT i.indexname, i.indexdef,
		       CASE WHEN i.indexdef LIKE '%UNIQUE%' THEN true ELSE false END AS is_unique
		FROM pg_indexes i
		WHERE i.schemaname = $1 AND i.tablename = $2
		ORDER BY i.indexname
	`
	rows, err := p.pool.Query(ctx, q, schema, table)
	if err != nil {
		return nil, pgAdapterError("INDEX_QUERY_FAILED",
			"Failed to query indexes", ctx, err)
	}
	defer rows.Close()

	idx := make([]types.IndexInfo, 0)
	for rows.Next() {
		var name, def string
		var unique bool
		if err := rows.Scan(&name, &def, &unique); err != nil {
			p.logger.Warnf("Failed to scan index information: %v", err)
			continue
		}
		idx = append(idx, types.IndexInfo{
			Name:    name,
			Columns: parseIndexColumns(def),
			Unique:  unique,
		})
	}
	return idx, nil
}

// parseIndexColumns extracts the column list from a pg_indexes indexdef string.
// Simplified: takes the content between the first "(" and the matching ")".
func parseIndexColumns(def string) []string {
	start := strings.Index(def, "(")
	end := strings.Index(def, ")")
	if start < 0 || end < 0 || start+1 >= end {
		return nil
	}
	raw := strings.Split(def[start+1:end], ",")
	out := make([]string, 0, len(raw))
	for _, c := range raw {
		out = append(out, strings.TrimSpace(c))
	}
	return out
}
