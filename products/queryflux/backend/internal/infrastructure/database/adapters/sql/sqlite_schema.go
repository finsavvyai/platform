package sql

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// GetSchema returns table metadata for the connected SQLite database.
// User tables only — `sqlite_%` system tables are excluded.
func (s *SQLiteAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.db == nil {
		return nil, notConnected()
	}

	rows, err := s.db.QueryContext(ctx, sqliteListTablesSQL)
	if err != nil {
		return nil, wrapScan("SCHEMA_QUERY_FAILED", "Failed to query schema information", err)
	}
	tableNames, err := scanTableNames(rows)
	rows.Close()
	if err != nil {
		return nil, err
	}

	tables := make([]types.TableInfo, 0, len(tableNames))
	for _, name := range tableNames {
		info, terr := s.getTableInfoLocked(ctx, name)
		if terr != nil {
			if s.logger != nil {
				s.logger.Warnf("Failed to get table info for %s: %v", name, terr)
			}
			info = &types.TableInfo{Name: name, Schema: "main"}
		}
		tables = append(tables, *info)
	}
	return &types.SchemaInfo{Tables: tables}, nil
}

// IntrospectSchema is the Phase 1 alias for GetSchema (QUERY_CONTRACT.md §2).
func (s *SQLiteAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return s.GetSchema(ctx)
}

// GetTableInfo returns column + index metadata for a single SQLite table.
func (s *SQLiteAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	if s.db == nil {
		return nil, notConnected()
	}
	return s.getTableInfoLocked(ctx, tableName)
}

// getTableInfoLocked assumes the caller already holds s.mutex.
func (s *SQLiteAdapter) getTableInfoLocked(ctx context.Context, tableName string) (*types.TableInfo, error) {
	columns, err := s.queryColumns(ctx, tableName)
	if err != nil {
		return nil, err
	}
	indexes := s.queryIndexes(ctx, tableName)
	return &types.TableInfo{
		Name:    tableName,
		Schema:  "main",
		Columns: columns,
		Indexes: indexes,
	}, nil
}

func (s *SQLiteAdapter) queryColumns(ctx context.Context, table string) ([]types.ColumnInfo, error) {
	// PRAGMA does not accept positional params, so the table name must be
	// interpolated. Validate via types.SafeIdentifier first — anything that
	// looks like SQL escape (`;`, quotes, `--`, spaces) is rejected with
	// ErrInvalidParam before the statement is built.
	safe, err := types.SafeIdentifier(table)
	if err != nil {
		return nil, types.NewAdapterError(
			"INVALID_IDENTIFIER",
			"Invalid table identifier",
			err.Error(),
		).WithSentinel(types.ErrInvalidParam)
	}
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", safe))
	if err != nil {
		return nil, wrapScan("TABLE_COLUMN_QUERY_FAILED", "Failed to query table columns", err)
	}
	defer rows.Close()

	var cols []types.ColumnInfo
	for rows.Next() {
		var cid, notNull, pk int
		var col types.ColumnInfo
		var def sql.NullString
		if err := rows.Scan(&cid, &col.Name, &col.Type, &notNull, &def, &pk); err != nil {
			return nil, wrapScan("COLUMN_SCAN_FAILED", "Failed to scan column information", err)
		}
		col.Nullable = notNull == 0
		col.IsPrimaryKey = pk == 1
		if def.Valid {
			col.DefaultValue = def.String
		}
		cols = append(cols, col)
	}
	return cols, nil
}

func (s *SQLiteAdapter) queryIndexes(ctx context.Context, table string) []types.IndexInfo {
	// PRAGMA cannot bind params; validate the identifier instead.
	safe, ierr := types.SafeIdentifier(table)
	if ierr != nil {
		if s.logger != nil {
			s.logger.Warnf("Rejected unsafe table identifier %q for PRAGMA index_list: %v", table, ierr)
		}
		return nil
	}
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf("PRAGMA index_list(%s)", safe))
	if err != nil {
		if s.logger != nil {
			s.logger.Warnf("Failed to query indexes for table %s: %v", table, err)
		}
		return nil
	}
	defer rows.Close()

	var idxs []types.IndexInfo
	for rows.Next() {
		var seq, unique int
		var name, origin, partial string
		if err := rows.Scan(&seq, &name, &unique, &origin, &partial); err != nil {
			if s.logger != nil {
				s.logger.Warnf("Failed to scan index row: %v", err)
			}
			continue
		}
		idxs = append(idxs, types.IndexInfo{
			Name:    name,
			Columns: s.queryIndexColumns(ctx, name),
			Unique:  unique == 1,
		})
	}
	return idxs
}

func (s *SQLiteAdapter) queryIndexColumns(ctx context.Context, indexName string) []string {
	// PRAGMA cannot bind params; validate the index identifier first.
	safe, ierr := types.SafeIdentifier(indexName)
	if ierr != nil {
		if s.logger != nil {
			s.logger.Warnf("Rejected unsafe index identifier %q for PRAGMA index_info: %v", indexName, ierr)
		}
		return nil
	}
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf("PRAGMA index_info(%s)", safe))
	if err != nil {
		return nil
	}
	defer rows.Close()
	var cols []string
	for rows.Next() {
		var seqno, cid int
		var col string
		if err := rows.Scan(&seqno, &cid, &col); err != nil {
			continue
		}
		cols = append(cols, col)
	}
	return cols
}

func scanTableNames(rows *sql.Rows) ([]string, error) {
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, wrapScan("SCHEMA_SCAN_FAILED", "Failed to scan schema row", err)
		}
		names = append(names, n)
	}
	if err := rows.Err(); err != nil {
		return nil, wrapScan("SCHEMA_ITERATION_FAILED", "Error during schema iteration", err)
	}
	return names, nil
}

const sqliteListTablesSQL = `
SELECT name
FROM sqlite_master
WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name
`
