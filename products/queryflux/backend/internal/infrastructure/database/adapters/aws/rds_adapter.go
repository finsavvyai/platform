package aws

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/sirupsen/logrus"
)

// RDSAdapter implements DatabaseAdapter for AWS RDS
// RDS supports multiple database engines (PostgreSQL, MySQL, MariaDB, etc.)
type RDSAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	engine string
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to AWS RDS
func (r *RDSAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.db != nil {
		return nil
	}

	r.conn = conn

	// Determine driver and connection string based on engine
	var driver, connStr string
	var err error

	switch r.engine {
	case "postgres", "aurora-postgresql":
		driver = "pgx"
		sslMode := "disable"
		if conn.SSL {
			sslMode = "require"
		}
		connStr = fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
			conn.Username, conn.Password, conn.Host, conn.Port, conn.Database, sslMode)
	case "mysql", "mariadb", "aurora-mysql":
		driver = "mysql"
		connStr, err = conn.GetConnectionString()
		if err != nil {
			return &types.AdapterError{
				Code:    "CONNECTION_STRING_ERROR",
				Message: "Failed to build connection string",
				Details: err.Error(),
			}
		}
	default:
		return &types.AdapterError{
			Code:    "UNSUPPORTED_ENGINE",
			Message: fmt.Sprintf("Unsupported RDS engine: %s", r.engine),
		}
	}

	db, err := sql.Open(driver, connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to connect to AWS RDS",
			Details: err.Error(),
		}
	}

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping AWS RDS",
			Details: err.Error(),
		}
	}

	r.db = db
	r.logger.Infof("Connected to AWS RDS (%s): %s", r.engine, conn.Name)
	return nil
}

// Disconnect closes the RDS connection
func (r *RDSAdapter) Disconnect(ctx context.Context) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.db == nil {
		return nil
	}

	if err := r.db.Close(); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to disconnect from AWS RDS",
			Details: err.Error(),
		}
	}

	r.db = nil
	r.logger.Infof("Disconnected from AWS RDS: %s", r.conn.Name)
	return nil
}

// TestConnection tests if the RDS connection is valid
func (r *RDSAdapter) TestConnection(ctx context.Context) error {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.db == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	if err := r.db.PingContext(ctx); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// ExecuteQuery executes a query on AWS RDS
func (r *RDSAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	rows, err := r.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	columns, _ := rows.Columns()
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	var resultRows []map[string]interface{}
	for rows.Next() {
		rows.Scan(valuePtrs...)
		row := make(map[string]interface{})
		for i, col := range columns {
			row[col] = values[i]
		}
		resultRows = append(resultRows, row)
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo(columns),
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

func (r *RDSAdapter) toColumnInfo(columns []string) []types.ColumnInfo {
	colInfos := make([]types.ColumnInfo, len(columns))
	for i, col := range columns {
		colInfos[i] = types.ColumnInfo{
			Name: col,
			Type: "string", // Default to string since we don't have type info from sql.Rows.Columns() easily without ColumnTypes
		}
	}
	return colInfos
}

// GetSchema retrieves schema information
func (r *RDSAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return &types.SchemaInfo{Tables: []types.TableInfo{}}, nil
}

// GetTableInfo retrieves table information
func (r *RDSAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	return &types.TableInfo{Name: tableName}, nil
}

// IsConnected returns true if connected
func (r *RDSAdapter) IsConnected() bool {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	return r.db != nil
}

// GetConnectionInfo returns connection information
func (r *RDSAdapter) GetConnectionInfo() *entities.Connection {
	return r.conn
}

// HealthCheck checks the health of the connection
func (r *RDSAdapter) HealthCheck(ctx context.Context) error {
	if r.db == nil {
		return &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to RDS"}
	}
	return r.db.PingContext(ctx)
}

// Ping pings the database
func (r *RDSAdapter) Ping(ctx context.Context) error {
	return r.HealthCheck(ctx)
}

// GetMetrics retrieves connection metrics
func (r *RDSAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if r.db == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to RDS"}
	}

	stats := r.db.Stats()
	return &types.ConnectionMetrics{
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections:    stats.OpenConnections,
			IdleConnections:    stats.Idle,
			InUseConnections:   stats.InUse,
			WaitCount:          int64(stats.WaitCount),
			WaitDuration:       stats.WaitDuration,
			MaxOpenConnections: stats.MaxOpenConnections,
		},
	}, nil
}

type RDSTransaction struct {
	tx *sql.Tx
}

func (t *RDSTransaction) Commit() error {
	return t.tx.Commit()
}

func (t *RDSTransaction) Rollback() error {
	return t.tx.Rollback()
}

// BeginTransaction starts a new transaction
func (r *RDSAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if r.db == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to RDS"}
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &RDSTransaction{tx: tx}, nil
}
