package sql

import (
	"context"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// GetSchema retrieves PostgreSQL database schema information for all
// non-system tables. Returns *types.SchemaInfo with per-table column metadata.
func (p *PostgreSQLAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.pool == nil {
		return nil, notConnectedError()
	}

	const q = `
		SELECT t.table_schema, t.table_name
		FROM information_schema.tables t
		WHERE t.table_type = 'BASE TABLE'
		  AND t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		ORDER BY t.table_schema, t.table_name
	`
	rows, err := p.pool.Query(ctx, q)
	if err != nil {
		return nil, pgAdapterError("SCHEMA_QUERY_FAILED",
			"Failed to query schema information", ctx, err)
	}
	defer rows.Close()

	tables := make([]types.TableInfo, 0)
	for rows.Next() {
		var schema, table string
		if err := rows.Scan(&schema, &table); err != nil {
			return nil, pgAdapterError("SCHEMA_SCAN_FAILED",
				"Failed to scan schema row", ctx, err)
		}
		info, ierr := p.getTableInfoLocked(ctx, schema, table)
		if ierr != nil {
			p.logger.Warnf("Failed to get table info for %s.%s: %v", schema, table, ierr)
			info = &types.TableInfo{Name: table, Schema: schema}
		}
		tables = append(tables, *info)
	}
	if err := rows.Err(); err != nil {
		return nil, pgAdapterError("SCHEMA_ITERATION_FAILED",
			"Error during schema iteration", ctx, err)
	}
	return &types.SchemaInfo{Tables: tables}, nil
}

// IntrospectSchema is the Phase 1 contract-preferred name. It delegates to
// GetSchema per QUERY_CONTRACT.md §2.
func (p *PostgreSQLAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return p.GetSchema(ctx)
}

// GetTableInfo retrieves column + index metadata for a single table.
// tableName may be "schema.table" or just "table" (defaults to public).
func (p *PostgreSQLAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.pool == nil {
		return nil, notConnectedError()
	}
	schema, table := splitSchemaTable(tableName)
	return p.getTableInfoLocked(ctx, schema, table)
}

// getTableInfoLocked is the lock-free internal worker — callers MUST hold
// p.mutex.RLock(). It queries information_schema for columns and pg_indexes
// for indexes via parameterised statements ($1, $2).
func (p *PostgreSQLAdapter) getTableInfoLocked(ctx context.Context, schema, table string) (*types.TableInfo, error) {
	cols, err := p.queryColumns(ctx, schema, table)
	if err != nil {
		return nil, err
	}
	idx, err := p.queryIndexes(ctx, schema, table)
	if err != nil {
		// non-fatal — log and continue without indexes
		p.logger.Warnf("Failed to query indexes for %s.%s: %v", schema, table, err)
		idx = nil
	}
	return &types.TableInfo{
		Name:    table,
		Schema:  schema,
		Columns: cols,
		Indexes: idx,
	}, nil
}

// splitSchemaTable parses "schema.table" or returns ("public", input).
func splitSchemaTable(name string) (string, string) {
	parts := strings.Split(name, ".")
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return "public", name
}

