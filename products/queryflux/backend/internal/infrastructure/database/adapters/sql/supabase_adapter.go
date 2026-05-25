package sql

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

// SupabaseAdapter implements DatabaseAdapter for Supabase (PostgreSQL-based)
type SupabaseAdapter struct {
	conn   *entities.Connection
	pool   *pgxpool.Pool
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to Supabase
func (s *SupabaseAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.pool != nil {
		return nil // Already connected
	}

	// Update connection info
	s.conn = conn

	// Build connection string
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_STRING_ERROR",
			Message: "Failed to build connection string",
			Details: err.Error(),
		}
	}

	// Configure connection pool for Supabase
	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONFIG_PARSE_ERROR",
			Message: "Failed to parse Supabase connection configuration",
			Details: err.Error(),
		}
	}

	// Set pool configuration optimized for Supabase
	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = 0 // No limit
	config.MaxConnIdleTime = 0 // No limit

	// Create connection pool
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to create Supabase connection pool",
			Details: err.Error(),
		}
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping Supabase database",
			Details: err.Error(),
		}
	}

	s.pool = pool
	s.logger.Infof("Connected to Supabase database: %s", conn.Name)

	return nil
}

// Disconnect closes the Supabase connection
func (s *SupabaseAdapter) Disconnect(ctx context.Context) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.pool == nil {
		return nil // Already disconnected
	}

	s.pool.Close()
	s.pool = nil
	s.logger.Infof("Disconnected from Supabase database: %s", s.conn.Name)

	return nil
}

// Shutdown closes the connection
func (s *SupabaseAdapter) Shutdown(ctx context.Context) error {
	return s.Disconnect(ctx)
}

// Ping checks the connection
func (s *SupabaseAdapter) Ping(ctx context.Context) error {
	return s.TestConnection(ctx)
}

// HealthCheck checks the health of the connection
func (s *SupabaseAdapter) HealthCheck(ctx context.Context) error {
	return s.Ping(ctx)
}

// GetMetrics returns connection metrics
func (s *SupabaseAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "supabase",
			Version: "postgres",
		},
	}, nil
}

// BeginTransaction starts a new transaction
func (s *SupabaseAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	return &SupabaseTransaction{tx: tx, ctx: ctx}, nil
}

type SupabaseTransaction struct {
	tx  pgx.Tx
	ctx context.Context
}

func (t *SupabaseTransaction) Commit() error {
	return t.tx.Commit(t.ctx)
}

func (t *SupabaseTransaction) Rollback() error {
	return t.tx.Rollback(t.ctx)
}

// GetColumns returns column information for a table
func (s *SupabaseAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := s.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}

// TestConnection tests if the Supabase connection is valid
func (s *SupabaseAdapter) TestConnection(ctx context.Context) error {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.pool == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	if err := s.pool.Ping(ctx); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// ExecuteQuery executes a Supabase query and returns results
func (s *SupabaseAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.pool == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Trim and validate query
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, &types.AdapterError{
			Code:    "EMPTY_QUERY",
			Message: "Query cannot be empty",
		}
	}

	// Execute query
	rows, err := s.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	// Get column descriptions
	fieldDescriptions := rows.FieldDescriptions()
	columns := make([]types.ColumnInfo, len(fieldDescriptions))
	colNames := make([]string, len(fieldDescriptions))

	for i, fd := range fieldDescriptions {
		name := string(fd.Name)
		colNames[i] = name
		columns[i] = types.ColumnInfo{
			Name: name,
			Type: fmt.Sprintf("%d", fd.DataTypeOID), // Use OID as type for now
		}
	}

	// Collect rows
	var resultRows []map[string]interface{}
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, &types.AdapterError{
				Code:    "ROW_SCAN_FAILED",
				Message: "Failed to scan row",
				Details: err.Error(),
			}
		}

		row := make(map[string]interface{})
		for i, col := range colNames {
			row[col] = values[i]
		}
		resultRows = append(resultRows, row)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "ROWS_ITERATION_FAILED",
			Message: "Error during rows iteration",
			Details: err.Error(),
		}
	}

	return &types.QueryResult{
		Columns: columns,
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// GetSchema retrieves Supabase database schema information
func (s *SupabaseAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.pool == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Query to get all tables, including Supabase-specific schemas
	query := `
		SELECT 
			t.table_schema,
			t.table_name
		FROM information_schema.tables t
		WHERE t.table_type = 'BASE TABLE'
		AND t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		ORDER BY t.table_schema, t.table_name
	`

	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to query schema information",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var schema, tableName string
		if err := rows.Scan(&schema, &tableName); err != nil {
			return nil, &types.AdapterError{
				Code:    "SCHEMA_SCAN_FAILED",
				Message: "Failed to scan schema row",
				Details: err.Error(),
			}
		}

		// Get detailed table information
		tableInfo, err := s.GetTableInfo(ctx, fmt.Sprintf("%s.%s", schema, tableName))
		if err != nil {
			s.logger.Warnf("Failed to get table info for %s.%s: %v", schema, tableName, err)
			// Continue with basic info
			tableInfo = &types.TableInfo{
				Name:   tableName,
				Schema: schema,
			}
		}

		tables = append(tables, *tableInfo)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_ITERATION_FAILED",
			Message: "Error during schema iteration",
			Details: err.Error(),
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific Supabase table
func (s *SupabaseAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.pool == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Parse schema and table name
	parts := strings.Split(tableName, ".")
	var schema, table string
	if len(parts) == 2 {
		schema = parts[0]
		table = parts[1]
	} else {
		schema = "public"
		table = tableName
	}

	// Get column information with Supabase-specific enhancements
	columnQuery := `
		SELECT 
			c.column_name,
			c.data_type,
			c.is_nullable,
			c.column_default,
			CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
			c.is_identity,
			c.identity_generation
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

	rows, err := s.pool.Query(ctx, columnQuery, schema, table)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_COLUMN_QUERY_FAILED",
			Message: "Failed to query table columns",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		var col types.ColumnInfo
		var nullable string
		var defaultValue *string
		var isIdentity, identityGeneration *string

		if err := rows.Scan(&col.Name, &col.Type, &nullable, &defaultValue, &col.IsPrimaryKey, &isIdentity, &identityGeneration); err != nil {
			return nil, &types.AdapterError{
				Code:    "COLUMN_SCAN_FAILED",
				Message: "Failed to scan column information",
				Details: err.Error(),
			}
		}

		col.Nullable = nullable == "YES"
		if defaultValue != nil {
			col.DefaultValue = *defaultValue
		}

		// Handle Supabase identity columns
		if isIdentity != nil && *isIdentity == "YES" {
			if identityGeneration != nil {
				col.DefaultValue = fmt.Sprintf("IDENTITY (%s)", *identityGeneration)
			} else {
				col.DefaultValue = "IDENTITY"
			}
		}

		columns = append(columns, col)
	}

	// Get index information including Supabase-specific indexes
	indexQuery := `
		SELECT 
			i.indexname,
			i.indexdef,
			CASE WHEN i.indexdef LIKE '%UNIQUE%' THEN true ELSE false END as is_unique
		FROM pg_indexes i
		WHERE i.schemaname = $1 AND i.tablename = $2
		ORDER BY i.indexname
	`

	indexRows, err := s.pool.Query(ctx, indexQuery, schema, table)
	if err != nil {
		s.logger.Warnf("Failed to query indexes for table %s.%s: %v", schema, table, err)
	} else {
		defer indexRows.Close()

		var indexes []types.IndexInfo
		for indexRows.Next() {
			var indexName, indexDef string
			var isUnique bool

			if err := indexRows.Scan(&indexName, &indexDef, &isUnique); err != nil {
				s.logger.Warnf("Failed to scan index information: %v", err)
				continue
			}

			// Extract column names from index definition (simplified)
			var indexColumns []string
			if strings.Contains(indexDef, "(") && strings.Contains(indexDef, ")") {
				start := strings.Index(indexDef, "(") + 1
				end := strings.Index(indexDef, ")")
				if start < end {
					colStr := indexDef[start:end]
					indexColumns = strings.Split(strings.TrimSpace(colStr), ",")
					for i, col := range indexColumns {
						indexColumns[i] = strings.TrimSpace(col)
					}
				}
			}

			indexes = append(indexes, types.IndexInfo{
				Name:    indexName,
				Columns: indexColumns,
				Unique:  isUnique,
			})
		}

		return &types.TableInfo{
			Name:    table,
			Schema:  schema,
			Columns: columns,
			Indexes: indexes,
		}, nil
	}

	return &types.TableInfo{
		Name:    table,
		Schema:  schema,
		Columns: columns,
	}, nil
}

// GetSupabaseMetadata retrieves Supabase-specific metadata
func (s *SupabaseAdapter) GetSupabaseMetadata(ctx context.Context) (*entities.SupabaseMetadata, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.pool == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	metadata := &entities.SupabaseMetadata{}

	// Get RLS policies
	rlsQuery := `
		SELECT 
			schemaname,
			tablename,
			policyname,
			permissive,
			roles,
			cmd,
			qual,
			with_check
		FROM pg_policies
		ORDER BY schemaname, tablename, policyname
	`

	rows, err := s.pool.Query(ctx, rlsQuery)
	if err != nil {
		s.logger.Warnf("Failed to query RLS policies: %v", err)
	} else {
		defer rows.Close()

		policies := make([]entities.RLSPolicy, 0)
		for rows.Next() {
			var p entities.RLSPolicy
			var roles []string
			var qual, withCheck *string

			if err := rows.Scan(&p.SchemaName, &p.TableName, &p.PolicyName,
				&p.Permissive, &roles, &p.Command, &qual, &withCheck); err != nil {
				s.logger.Warnf("Failed to scan RLS policy: %v", err)
				continue
			}

			p.Roles = roles
			if qual != nil {
				p.Expression = *qual
			}
			if withCheck != nil {
				p.WithCheck = *withCheck
			}

			policies = append(policies, p)
		}
		metadata.RLSPolicies = policies
	}

	// Get functions (stored procedures)
	functionsQuery := `
		SELECT 
			n.nspname as schema_name,
			p.proname as function_name,
			pg_get_function_result(p.oid) as return_type,
			pg_get_function_arguments(p.oid) as arguments
		FROM pg_proc p
		JOIN pg_namespace n ON p.pronamespace = n.oid
		WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		ORDER BY n.nspname, p.proname
	`

	funcRows, err := s.pool.Query(ctx, functionsQuery)
	if err != nil {
		s.logger.Warnf("Failed to query functions: %v", err)
	} else {
		defer funcRows.Close()

		functions := make([]entities.SupabaseFunction, 0)
		for funcRows.Next() {
			var f entities.SupabaseFunction

			if err := funcRows.Scan(&f.SchemaName, &f.FunctionName,
				&f.ReturnType, &f.Arguments); err != nil {
				s.logger.Warnf("Failed to scan function: %v", err)
				continue
			}

			functions = append(functions, f)
		}
		metadata.Functions = functions
	}

	return metadata, nil
}

// RLSPolicy represents a Row Level Security policy
// (using domain entities)

// IsConnected returns true if the adapter is connected to Supabase
func (s *SupabaseAdapter) IsConnected() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return s.pool != nil
}

// GetConnectionInfo returns the connection information
func (s *SupabaseAdapter) GetConnectionInfo() *entities.Connection {
	return s.conn
}
