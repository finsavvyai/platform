package sql

import (
	"context"
	"database/sql"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (m *MySQLAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return m.GetSchema(ctx)
}

// GetSchema lists all base tables in the current MySQL database.
func (m *MySQLAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.db == nil {
		return nil, wrapMySQLAdapterErr("MySQL.GetSchema", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
	}

	const q = `
		SELECT TABLE_SCHEMA, TABLE_NAME
		FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_TYPE = 'BASE TABLE'
		  AND TABLE_SCHEMA = DATABASE()
		ORDER BY TABLE_SCHEMA, TABLE_NAME`

	rows, err := m.db.QueryContext(ctx, q)
	if err != nil {
		return nil, mapMySQLError(ctx, "MySQL.GetSchema.Query", err)
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var schema, name string
		if err := rows.Scan(&schema, &name); err != nil {
			return nil, mapMySQLError(ctx, "MySQL.GetSchema.Scan", err)
		}
		info, err := m.GetTableInfo(ctx, name)
		if err != nil {
			m.logger.Warnf("Failed to get table info for %s: %v", name, err)
			info = &types.TableInfo{Name: name, Schema: schema}
		}
		tables = append(tables, *info)
	}
	if err := rows.Err(); err != nil {
		return nil, mapMySQLError(ctx, "MySQL.GetSchema.RowsErr", err)
	}
	return &types.SchemaInfo{Tables: tables}, nil
}

// GetTableInfo introspects columns + indexes for a single MySQL table.
func (m *MySQLAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.db == nil {
		return nil, wrapMySQLAdapterErr("MySQL.GetTableInfo", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
	}

	var currentDB string
	if err := m.db.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&currentDB); err != nil {
		return nil, mapMySQLError(ctx, "MySQL.CurrentDB", err)
	}

	columns, err := m.fetchMySQLColumns(ctx, currentDB, tableName)
	if err != nil {
		return nil, err
	}
	indexes := m.fetchMySQLIndexes(ctx, currentDB, tableName)

	return &types.TableInfo{Name: tableName, Schema: currentDB, Columns: columns, Indexes: indexes}, nil
}

func (m *MySQLAdapter) fetchMySQLColumns(ctx context.Context, dbName, tableName string) ([]types.ColumnInfo, error) {
	const q = `
		SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION`

	rows, err := m.db.QueryContext(ctx, q, dbName, tableName)
	if err != nil {
		return nil, mapMySQLError(ctx, "MySQL.fetchColumns", err)
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		var col types.ColumnInfo
		var nullable, columnKey string
		var defaultValue sql.NullString
		if err := rows.Scan(&col.Name, &col.Type, &nullable, &defaultValue, &columnKey); err != nil {
			return nil, mapMySQLError(ctx, "MySQL.fetchColumns.Scan", err)
		}
		col.Nullable = nullable == "YES"
		col.IsPrimaryKey = columnKey == "PRI"
		if defaultValue.Valid {
			col.DefaultValue = defaultValue.String
		}
		columns = append(columns, col)
	}
	return columns, nil
}

func (m *MySQLAdapter) fetchMySQLIndexes(ctx context.Context, dbName, tableName string) []types.IndexInfo {
	const q = `
		SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
		FROM INFORMATION_SCHEMA.STATISTICS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY INDEX_NAME, SEQ_IN_INDEX`

	rows, err := m.db.QueryContext(ctx, q, dbName, tableName)
	if err != nil {
		m.logger.Warnf("Failed to query indexes for table %s: %v", tableName, err)
		return nil
	}
	defer rows.Close()

	indexMap := make(map[string]*types.IndexInfo)
	for rows.Next() {
		var indexName, columnName string
		var nonUnique int
		if err := rows.Scan(&indexName, &columnName, &nonUnique); err != nil {
			m.logger.Warnf("Failed to scan index information: %v", err)
			continue
		}
		if idx, ok := indexMap[indexName]; ok {
			idx.Columns = append(idx.Columns, columnName)
		} else {
			indexMap[indexName] = &types.IndexInfo{Name: indexName, Columns: []string{columnName}, Unique: nonUnique == 0}
		}
	}

	out := make([]types.IndexInfo, 0, len(indexMap))
	for _, idx := range indexMap {
		out = append(out, *idx)
	}
	return out
}
