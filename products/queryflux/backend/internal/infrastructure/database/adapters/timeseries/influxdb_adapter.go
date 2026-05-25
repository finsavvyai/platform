package timeseries

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/sirupsen/logrus"
)

// InfluxDBAdapter implements DatabaseAdapter for InfluxDB
type InfluxDBAdapter struct {
	conn   *entities.Connection
	client influxdb2.Client
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to InfluxDB
func (i *InfluxDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	i.mutex.Lock()
	defer i.mutex.Unlock()

	if i.client != nil {
		return nil // Already connected
	}

	// Update connection info
	i.conn = conn

	// Build connection URL
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_STRING_ERROR",
			Message: "Failed to build connection string",
			Details: err.Error(),
		}
	}

	// Extract token from password field or options
	token := conn.Password
	if token == "" {
		token = conn.Options["token"]
	}

	// Create InfluxDB client
	client := influxdb2.NewClient(connStr, token)

	// Test the connection
	health, err := client.Health(ctx)
	if err != nil {
		client.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to connect to InfluxDB",
			Details: err.Error(),
		}
	}

	if health.Status != "pass" {
		client.Close()
		return &types.AdapterError{
			Code:    "HEALTH_CHECK_FAILED",
			Message: fmt.Sprintf("InfluxDB health check failed: %s", health.Status),
		}
	}

	i.client = client
	i.logger.Infof("Connected to InfluxDB: %s", conn.Name)

	return nil
}

// Disconnect closes the InfluxDB connection
func (i *InfluxDBAdapter) Disconnect(ctx context.Context) error {
	i.mutex.Lock()
	defer i.mutex.Unlock()

	if i.client == nil {
		return nil // Already disconnected
	}

	i.client.Close()
	i.client = nil
	i.logger.Infof("Disconnected from InfluxDB: %s", i.conn.Name)

	return nil
}

// IsConnected returns true if the adapter is connected to InfluxDB
func (i *InfluxDBAdapter) IsConnected() bool {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	return i.client != nil
}

// TestConnection tests if the InfluxDB connection is valid
func (i *InfluxDBAdapter) TestConnection(ctx context.Context) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if i.client == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to InfluxDB",
		}
	}

	health, err := i.client.Health(ctx)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	if health.Status != "pass" {
		return &types.AdapterError{
			Code:    "HEALTH_CHECK_FAILED",
			Message: fmt.Sprintf("InfluxDB health check failed: %s", health.Status),
		}
	}

	return nil
}

// ExecuteQuery executes an InfluxDB query (Flux or InfluxQL)
func (i *InfluxDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if i.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to InfluxDB",
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

	// Get organization from options or use default
	org := i.conn.Options["organization"]
	if org == "" {
		org = i.conn.Options["org"]
	}
	if org == "" {
		org = "default"
	}

	// Create query API
	queryAPI := i.client.QueryAPI(org)

	// Execute query
	result, err := queryAPI.Query(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute InfluxDB query",
			Details: err.Error(),
		}
	}

	// Convert results
	return i.convertInfluxDBResult(result)
}

// GetSchema retrieves InfluxDB schema information
func (i *InfluxDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if i.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to InfluxDB",
		}
	}

	// Get organization
	org := i.conn.Options["organization"]
	if org == "" {
		org = i.conn.Options["org"]
	}
	if org == "" {
		org = "default"
	}

	// Query to get buckets (equivalent to databases)
	query := `buckets()`
	queryAPI := i.client.QueryAPI(org)

	result, err := queryAPI.Query(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to query InfluxDB schema",
			Details: err.Error(),
		}
	}

	var tables []types.TableInfo
	for result.Next() {
		record := result.Record()
		if bucketName, exists := record.Values()["name"]; exists {
			if name, ok := bucketName.(string); ok {
				// Get measurements for this bucket
				measurements, err := i.getMeasurements(ctx, org, name)
				if err != nil {
					i.logger.Warnf("Failed to get measurements for bucket %s: %v", name, err)
					measurements = []types.TableInfo{}
				}

				// Add bucket as a "schema" and measurements as tables
				tables = append(tables, measurements...)
			}
		}
	}

	if result.Err() != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_ITERATION_FAILED",
			Message: "Error during schema iteration",
			Details: result.Err().Error(),
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific measurement
func (i *InfluxDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if i.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to InfluxDB",
		}
	}

	// Parse bucket and measurement name
	parts := strings.Split(tableName, ".")
	var bucket, measurement string
	if len(parts) == 2 {
		bucket = parts[0]
		measurement = parts[1]
	} else {
		bucket = i.conn.Database
		measurement = tableName
	}

	if bucket == "" {
		bucket = "default"
	}

	// Get organization
	org := i.conn.Options["organization"]
	if org == "" {
		org = i.conn.Options["org"]
	}
	if org == "" {
		org = "default"
	}

	// Query to get field keys and tag keys
	query := fmt.Sprintf(`
		import "influxdata/influxdb/schema"
		
		fieldKeys = schema.fieldKeys(bucket: "%s", measurement: "%s")
		tagKeys = schema.tagKeys(bucket: "%s", measurement: "%s")
		
		union(tables: [fieldKeys, tagKeys])
	`, bucket, measurement, bucket, measurement)

	queryAPI := i.client.QueryAPI(org)
	result, err := queryAPI.Query(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_INFO_QUERY_FAILED",
			Message: "Failed to query measurement information",
			Details: err.Error(),
		}
	}

	var columns []types.ColumnInfo

	// Add standard InfluxDB columns
	columns = append(columns, types.ColumnInfo{
		Name:         "_time",
		Type:         "timestamp",
		Nullable:     false,
		IsPrimaryKey: true,
	})

	// Process field and tag keys
	for result.Next() {
		record := result.Record()
		if keyName, exists := record.Values()["_value"]; exists {
			if name, ok := keyName.(string); ok {
				columnType := "string" // Default type
				if keyType, exists := record.Values()["_field"]; exists && keyType != nil {
					columnType = "field"
				}

				columns = append(columns, types.ColumnInfo{
					Name:     name,
					Type:     columnType,
					Nullable: true,
				})
			}
		}
	}

	return &types.TableInfo{
		Name:    measurement,
		Schema:  bucket,
		Columns: columns,
	}, nil
}

// GetConnectionInfo returns the connection information
func (i *InfluxDBAdapter) GetConnectionInfo() *entities.Connection {
	return i.conn
}

// Helper methods

func (i *InfluxDBAdapter) getMeasurements(ctx context.Context, org, bucket string) ([]types.TableInfo, error) {
	query := fmt.Sprintf(`
		import "influxdata/influxdb/schema"
		schema.measurements(bucket: "%s")
	`, bucket)

	queryAPI := i.client.QueryAPI(org)
	result, err := queryAPI.Query(ctx, query)
	if err != nil {
		return nil, err
	}

	var tables []types.TableInfo
	for result.Next() {
		record := result.Record()
		if measurementName, exists := record.Values()["_value"]; exists {
			if name, ok := measurementName.(string); ok {
				tables = append(tables, types.TableInfo{
					Name:   name,
					Schema: bucket,
				})
			}
		}
	}

	return tables, result.Err()
}

func (i *InfluxDBAdapter) convertInfluxDBResult(result *api.QueryTableResult) (*types.QueryResult, error) {
	var columns []string
	var rows []map[string]interface{}
	columnSet := make(map[string]bool)

	// Process all records
	for result.Next() {
		record := result.Record()
		row := make(map[string]interface{})

		// Add all values from the record
		for key, value := range record.Values() {
			row[key] = value
			if !columnSet[key] {
				columns = append(columns, key)
				columnSet[key] = true
			}
		}

		// Add time field
		row["_time"] = record.Time()
		if !columnSet["_time"] {
			columns = append(columns, "_time")
			columnSet["_time"] = true
		}

		rows = append(rows, row)
	}

	if result.Err() != nil {
		return nil, &types.AdapterError{
			Code:    "RESULT_PROCESSING_FAILED",
			Message: "Failed to process InfluxDB result",
			Details: result.Err().Error(),
		}
	}

	// Convert to ColumnInfo
	var columnInfos []types.ColumnInfo
	for _, colName := range columns {
		colType := "string"
		if colName == "_time" {
			colType = "timestamp"
		} else if colName == "_value" {
			colType = "float" // Default usually, though can be other types
		}

		columnInfos = append(columnInfos, types.ColumnInfo{
			Name: colName,
			Type: colType,
		})
	}

	return &types.QueryResult{
		Columns: columnInfos,
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}

// BeginTransaction starts a new transaction (not supported for InfluxDB)
func (i *InfluxDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, &types.AdapterError{
		Code:    "UNSUPPORTED_OPERATION",
		Message: "Transactions are not supported for InfluxDB",
	}
}

// HealthCheck performs a health check on the InfluxDB connection
func (i *InfluxDBAdapter) HealthCheck(ctx context.Context) error {
	return i.TestConnection(ctx)
}

// GetMetrics returns metrics for the InfluxDB connection
func (i *InfluxDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return nil, &types.AdapterError{
		Code:    "UNSUPPORTED_OPERATION",
		Message: "Metrics are not yet implemented for InfluxDB",
	}
}

// Ping checks the connection
func (i *InfluxDBAdapter) Ping(ctx context.Context) error {
	return i.TestConnection(ctx)
}
