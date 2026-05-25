package sql

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (m *MariaDBAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return m.GetSchema(ctx)
}

// GetSchema lists all base tables in the current MariaDB database.
func (m *MariaDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.db == nil {
		return nil, wrapMySQLAdapterErr("MariaDB.GetSchema", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
	}

	const q = `
		SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_COMMENT
		FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_TYPE = 'BASE TABLE'
		  AND TABLE_SCHEMA = DATABASE()
		ORDER BY TABLE_SCHEMA, TABLE_NAME`

	rows, err := m.db.QueryContext(ctx, q)
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDB.GetSchema.Query", err)
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var schema, name, tableType, engine, comment string
		if err := rows.Scan(&schema, &name, &tableType, &engine, &comment); err != nil {
			return nil, mapMySQLError(ctx, "MariaDB.GetSchema.Scan", err)
		}
		info, err := m.GetTableInfo(ctx, name)
		if err != nil {
			m.logger.Warnf("Failed to get table info for %s: %v", name, err)
			info = &types.TableInfo{Name: name, Schema: schema}
		}
		tables = append(tables, *info)
	}
	if err := rows.Err(); err != nil {
		return nil, mapMySQLError(ctx, "MariaDB.GetSchema.RowsErr", err)
	}
	return &types.SchemaInfo{Tables: tables}, nil
}

// GetTableInfo introspects a single MariaDB table.
func (m *MariaDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.db == nil {
		return nil, wrapMySQLAdapterErr("MariaDB.GetTableInfo", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
	}

	var currentDB string
	if err := m.db.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&currentDB); err != nil {
		return nil, mapMySQLError(ctx, "MariaDB.CurrentDB", err)
	}

	columns, err := m.fetchMariaDBColumns(ctx, currentDB, tableName)
	if err != nil {
		return nil, err
	}
	indexes := m.fetchMariaDBIndexes(ctx, currentDB, tableName)

	return &types.TableInfo{Name: tableName, Schema: currentDB, Columns: columns, Indexes: indexes}, nil
}

func (m *MariaDBAdapter) fetchMariaDBColumns(ctx context.Context, dbName, tableName string) ([]types.ColumnInfo, error) {
	const q = `
		SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
		       COLUMN_KEY, EXTRA, COLUMN_COMMENT
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION`

	rows, err := m.db.QueryContext(ctx, q, dbName, tableName)
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDB.fetchColumns", err)
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		var col types.ColumnInfo
		var nullable, columnKey, extra, comment string
		var defaultValue *string
		if err := rows.Scan(&col.Name, &col.Type, &nullable, &defaultValue, &columnKey, &extra, &comment); err != nil {
			return nil, mapMySQLError(ctx, "MariaDB.fetchColumns.Scan", err)
		}
		col.Nullable = nullable == "YES"
		col.IsPrimaryKey = columnKey == "PRI"
		if defaultValue != nil {
			col.DefaultValue = *defaultValue
		}
		columns = append(columns, col)
	}
	return columns, nil
}

func (m *MariaDBAdapter) fetchMariaDBIndexes(ctx context.Context, dbName, tableName string) []types.IndexInfo {
	const q = `
		SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE, INDEX_COMMENT
		FROM INFORMATION_SCHEMA.STATISTICS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY INDEX_NAME, SEQ_IN_INDEX`

	rows, err := m.db.QueryContext(ctx, q, dbName, tableName)
	if err != nil {
		m.logger.Warnf("Failed to query indexes for MariaDB table %s: %v", tableName, err)
		return nil
	}
	defer rows.Close()

	indexMap := make(map[string]*types.IndexInfo)
	for rows.Next() {
		var indexName, columnName, indexType, indexComment string
		var nonUnique int
		if err := rows.Scan(&indexName, &columnName, &nonUnique, &indexType, &indexComment); err != nil {
			m.logger.Warnf("Failed to scan MariaDB index information: %v", err)
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
