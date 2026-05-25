package sql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (a *MariaDBEnhancedAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

// GetSchema returns all base tables in the connected MariaDB database, with
// columns + indexes per table.
func (a *MariaDBEnhancedAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.db == nil {
		return nil, wrapMySQLAdapterErr("MariaDBEnhanced.GetSchema", "NOT_CONNECTED", "not connected to MariaDB", errMySQLNotConn)
	}

	schema := &types.SchemaInfo{Tables: []types.TableInfo{}}
	const q = "SELECT table_name, table_type, table_comment FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name"
	rows, err := a.db.QueryContext(ctx, q, a.conn.Database)
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDBEnhanced.GetSchema.Query", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, tableType, comment sql.NullString
		if err := rows.Scan(&tableName, &tableType, &comment); err != nil {
			continue
		}
		columns, err := a.getTableColumns(ctx, tableName.String)
		if err != nil {
			a.logger.Warnf("Failed to get columns for table %s: %v", tableName.String, err)
			continue
		}
		indexes, err := a.getTableIndexes(ctx, tableName.String)
		if err != nil {
			a.logger.Warnf("Failed to get indexes for table %s: %v", tableName.String, err)
			indexes = []types.IndexInfo{}
		}
		schema.Tables = append(schema.Tables, types.TableInfo{
			Name:    tableName.String,
			Schema:  a.conn.Database,
			Columns: columns,
			Indexes: indexes,
		})
	}
	return schema, nil
}

// GetTableInfo introspects a single MariaDB table.
func (a *MariaDBEnhancedAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	if a.db == nil {
		return nil, wrapMySQLAdapterErr("MariaDBEnhanced.GetTableInfo", "NOT_CONNECTED", "not connected to MariaDB", errMySQLNotConn)
	}
	columns, err := a.getTableColumns(ctx, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get table columns: %w", err)
	}
	indexes, err := a.getTableIndexes(ctx, tableName)
	if err != nil {
		a.logger.Warnf("Failed to get indexes for table %s: %v", tableName, err)
		indexes = []types.IndexInfo{}
	}
	return &types.TableInfo{
		Name:    tableName,
		Schema:  a.conn.Database,
		Columns: columns,
		Indexes: indexes,
	}, nil
}

func (a *MariaDBEnhancedAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	const q = `
		SELECT column_name, data_type, is_nullable, column_default,
		       column_key, extra, character_maximum_length,
		       numeric_precision, numeric_scale
		FROM information_schema.columns
		WHERE table_schema = ? AND table_name = ?
		ORDER BY ordinal_position`

	rows, err := a.db.QueryContext(ctx, q, a.conn.Database, tableName)
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDBEnhanced.getTableColumns", err)
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		col, ok := scanMariaDBEnhancedColumn(rows)
		if !ok {
			continue
		}
		columns = append(columns, col)
	}
	return columns, nil
}

// scanMariaDBEnhancedColumn extracts one columns-row into a ColumnInfo. The
// helper keeps getTableColumns under the file-size cap.
func scanMariaDBEnhancedColumn(rows *sql.Rows) (types.ColumnInfo, bool) {
	var name, dataType, nullable, defaultValue, columnKey, extra sql.NullString
	var maxLen, precision, scale sql.NullInt64
	if err := rows.Scan(&name, &dataType, &nullable, &defaultValue, &columnKey, &extra, &maxLen, &precision, &scale); err != nil {
		return types.ColumnInfo{}, false
	}

	fullType := dataType.String
	if maxLen.Valid && maxLen.Int64 > 0 {
		fullType += fmt.Sprintf("(%d)", maxLen.Int64)
	} else if precision.Valid {
		if scale.Valid && scale.Int64 > 0 {
			fullType += fmt.Sprintf("(%d,%d)", precision.Int64, scale.Int64)
		} else {
			fullType += fmt.Sprintf("(%d)", precision.Int64)
		}
	}
	if extra.Valid && strings.Contains(extra.String, "auto_increment") {
		fullType += " AUTO_INCREMENT"
	}

	return types.ColumnInfo{
		Name:         name.String,
		Type:         fullType,
		Nullable:     nullable.Valid && nullable.String == "YES",
		DefaultValue: defaultValue.String,
		IsPrimaryKey: columnKey.Valid && columnKey.String == "PRI",
	}, true
}

func (a *MariaDBEnhancedAdapter) getTableIndexes(ctx context.Context, tableName string) ([]types.IndexInfo, error) {
	const q = `
		SELECT index_name, column_name, non_unique, seq_in_index
		FROM information_schema.statistics
		WHERE table_schema = ? AND table_name = ?
		ORDER BY index_name, seq_in_index`

	rows, err := a.db.QueryContext(ctx, q, a.conn.Database, tableName)
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDBEnhanced.getTableIndexes", err)
	}
	defer rows.Close()

	indexMap := make(map[string][]string)
	for rows.Next() {
		var indexName, columnName sql.NullString
		var nonUnique, seqInIndex sql.NullInt64
		if err := rows.Scan(&indexName, &columnName, &nonUnique, &seqInIndex); err != nil {
			continue
		}
		key := indexName.String
		indexMap[key] = append(indexMap[key], columnName.String)
	}

	indexes := make([]types.IndexInfo, 0, len(indexMap))
	for name, cols := range indexMap {
		indexes = append(indexes, types.IndexInfo{
			Name:    name,
			Columns: cols,
			Unique:  name == "PRIMARY" || strings.HasPrefix(name, "uk_") || strings.HasPrefix(name, "unique_"),
		})
	}
	return indexes, nil
}
