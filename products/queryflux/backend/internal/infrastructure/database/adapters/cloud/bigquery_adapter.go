package cloud

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"cloud.google.com/go/bigquery"
	"github.com/sirupsen/logrus"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

// BigQueryAdapter provides connectivity to Google BigQuery
type BigQueryAdapter struct {
	conn      *entities.Connection
	client    *bigquery.Client
	projectID string
	dataset   string
	location  string
	logger    *logrus.Logger
}

// NewBigQueryAdapter creates a new BigQuery adapter
func NewBigQueryAdapter(conn *entities.Connection, logger *logrus.Logger) *BigQueryAdapter {
	projectID := conn.Host // Assuming Host is Project ID or from options
	if p, ok := conn.Options["project_id"]; ok {
		projectID = p
	}
	location := "US"
	if l, ok := conn.Options["location"]; ok {
		location = l
	}

	return &BigQueryAdapter{
		conn:      conn,
		projectID: projectID,
		dataset:   conn.Database,
		location:  location,
		logger:    logger,
	}
}

// Connect establishes a connection to BigQuery
func (a *BigQueryAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	if conn != nil {
		a.conn = conn
		// Update fields
		a.projectID = conn.Host
		if p, ok := conn.Options["project_id"]; ok {
			a.projectID = p
		}
		a.dataset = conn.Database
		if l, ok := conn.Options["location"]; ok {
			a.location = l
		}
	}

	var opts []option.ClientOption

	// Authentication options
	if cf, ok := a.conn.Options["credentials_file"]; ok && cf != "" {
		opts = append(opts, option.WithCredentialsFile(cf))
	} else if cj, ok := a.conn.Options["credentials_json"]; ok && cj != "" {
		opts = append(opts, option.WithCredentialsJSON([]byte(cj)))
	} else if a.conn.Username != "" && a.conn.Password != "" {
		// For service account credentials passed as username/password (fallback, though uncommon for BQ)
		opts = append(opts, option.WithCredentialsJSON([]byte(a.conn.Password)))
	}

	// Set endpoint if custom
	if endpoint, ok := a.conn.Options["endpoint"]; ok && endpoint != "" {
		opts = append(opts, option.WithEndpoint(endpoint))
	}

	// Create BigQuery client
	client, err := bigquery.NewClient(ctx, a.projectID, opts...)
	if err != nil {
		return fmt.Errorf("failed to create BigQuery client: %w", err)
	}

	a.client = client

	// Test connection by listing datasets
	it := client.Datasets(ctx)
	// Just fetch one to verify auth
	_, err = it.Next()
	if err != nil && err != iterator.Done {
		client.Close()
		return fmt.Errorf("failed to list datasets (connection test): %w", err)
	}

	// Verify the specified dataset exists if provided
	if a.dataset != "" {
		dataset := client.Dataset(a.dataset)
		if _, err := dataset.Metadata(ctx); err != nil {
			client.Close()
			return fmt.Errorf("dataset '%s' not found or accessible: %w", a.dataset, err)
		}
	}

	a.logger.Infof("Successfully connected to Google BigQuery (project: %s, dataset: %s)", a.projectID, a.dataset)
	return nil
}

// Disconnect closes the BigQuery connection
func (a *BigQueryAdapter) Disconnect(ctx context.Context) error {
	if a.client != nil {
		err := a.client.Close()
		a.client = nil
		a.logger.Info("BigQuery connection closed")
		return err
	}
	return nil
}

// IsConnected checks if the adapter is connected
func (a *BigQueryAdapter) IsConnected() bool {
	return a.client != nil
}

// GetConnectionInfo returns connection info
func (a *BigQueryAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// ExecuteQuery executes a SQL query against BigQuery
func (a *BigQueryAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.client == nil {
		return nil, fmt.Errorf("not connected to BigQuery")
	}

	startTime := time.Now()

	// Create query job
	q := a.client.Query(query)

	// Set default dataset if specified
	if a.dataset != "" {
		q.DefaultDatasetID = a.dataset
	}

	// Run the query
	job, err := q.Run(ctx)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Wait for job completion
	status, err := job.Wait(ctx)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	if err := status.Err(); err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Get the results
	it, err := job.Read(ctx)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Process the results
	var rows []map[string]interface{}
	var columns []types.ColumnInfo

	// Get schema information
	schema := it.Schema
	if schema != nil {
		columns = make([]types.ColumnInfo, len(schema))
		for i, field := range schema {
			columns[i] = types.ColumnInfo{
				Name:     field.Name,
				Type:     a.mapBigQueryType(field.Type),
				Nullable: !field.Required,
			}
		}
	}

	// Iterate through rows
	for {
		var row []bigquery.Value
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return &types.QueryResult{
				Query:         query,
				RowsAffected:  0,
				ExecutionTime: time.Since(startTime).Milliseconds(),
				Error:         err.Error(),
				Success:       false,
			}, nil
		}

		// Convert row to map
		rowMap := make(map[string]interface{})
		for i, value := range row {
			if i < len(columns) {
				rowMap[columns[i].Name] = a.convertBigQueryValue(value)
			}
		}
		rows = append(rows, rowMap)
	}

	executionTime := time.Since(startTime)

	return &types.QueryResult{
		Query:         query,
		Rows:          rows,
		Columns:       columns,
		RowsAffected:  int64(len(rows)),
		ExecutionTime: executionTime.Milliseconds(),
		Success:       true,
	}, nil
}

// GetSchema retrieves schema information from BigQuery
func (a *BigQueryAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.client == nil {
		return nil, fmt.Errorf("not connected to BigQuery")
	}

	schema := &types.SchemaInfo{
		Database: a.dataset,
		Tables:   make([]types.TableInfo, 0),
	}

	// List all tables in the dataset
	if a.dataset != "" {
		tables, err := a.listTables(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list tables: %w", err)
		}

		for _, tableName := range tables {
			// Get table metadata
			tableMD, err := a.client.Dataset(a.dataset).Table(tableName).Metadata(ctx)
			if err != nil {
				a.logger.Warnf("Failed to get metadata for table %s: %v", tableName, err)
				continue
			}

			columns := a.convertBigQuerySchema(tableMD.Schema)
			table := types.TableInfo{
				Name:    tableName,
				Schema:  a.dataset,
				Type:    string(tableMD.Type),
				Columns: columns,
			}
			schema.Tables = append(schema.Tables, table)
		}
	}

	return schema, nil
}

// GetTableInfo returns column information for a specific table
func (a *BigQueryAdapter) GetTableInfo(ctx context.Context, table string) (*types.TableInfo, error) {
	if a.dataset == "" {
		return nil, fmt.Errorf("dataset not specified")
	}

	tableMD, err := a.client.Dataset(a.dataset).Table(table).Metadata(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get table metadata: %w", err)
	}

	return &types.TableInfo{
		Name:    table,
		Schema:  a.dataset,
		Type:    string(tableMD.Type),
		Columns: a.convertBigQuerySchema(tableMD.Schema),
	}, nil
}

// BeginTransaction starts a new transaction
func (a *BigQueryAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	// BigQuery has limited transaction support
	return &BigQueryTransaction{adapter: a}, nil
}

// TestConnection tests if the connection is valid
func (a *BigQueryAdapter) TestConnection(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// HealthCheck checks the health of the BigQuery connection
func (a *BigQueryAdapter) HealthCheck(ctx context.Context) error {
	if a.client == nil {
		return fmt.Errorf("not connected to BigQuery")
	}

	// Simple health check using a SELECT 1 query
	q := a.client.Query("SELECT 1")
	_, err := q.Read(ctx)
	return err
}

// GetMetrics returns metrics
func (a *BigQueryAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{}, nil
}

// Ping checks the connection
func (a *BigQueryAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetadata retrieves metadata about the BigQuery connection
func (a *BigQueryAdapter) GetMetadata() map[string]interface{} {
	return map[string]interface{}{
		"engine":                "bigquery",
		"data_warehouse":        true,
		"cloud_native":          true,
		"columnar":              true,
		"serverless":            true,
		"project_id":            a.projectID,
		"dataset":               a.dataset,
		"location":              a.location,
		"supports_transactions": false,
	}
}

// Helper methods

func (a *BigQueryAdapter) listTables(ctx context.Context) ([]string, error) {
	if a.dataset == "" {
		return nil, fmt.Errorf("dataset not specified")
	}

	var tables []string
	it := a.client.Dataset(a.dataset).Tables(ctx)
	for {
		table, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to iterate tables: %w", err)
		}
		tables = append(tables, table.TableID)
	}

	return tables, nil
}

func (a *BigQueryAdapter) convertBigQuerySchema(schema bigquery.Schema) []types.ColumnInfo {
	if schema == nil {
		return []types.ColumnInfo{}
	}

	columns := make([]types.ColumnInfo, len(schema))
	for i, field := range schema {
		columns[i] = types.ColumnInfo{
			Name:     field.Name,
			Type:     a.mapBigQueryType(field.Type),
			Nullable: !field.Required,
			Default:  "", // BigQuery doesn't easily expose defaults
		}
	}
	return columns
}

func (a *BigQueryAdapter) mapBigQueryType(bigqueryType bigquery.FieldType) string {
	switch bigqueryType {
	case bigquery.StringFieldType:
		return "string"
	case bigquery.BytesFieldType:
		return "blob"
	case bigquery.IntegerFieldType:
		return "integer"
	case bigquery.FloatFieldType:
		return "double"
	case bigquery.BooleanFieldType:
		return "boolean"
	case bigquery.TimestampFieldType:
		return "timestamp"
	case bigquery.DateFieldType:
		return "date"
	case bigquery.TimeFieldType:
		return "time"
	case bigquery.DateTimeFieldType:
		return "datetime"
	case bigquery.NumericFieldType:
		return "decimal"
	// case bigquery.BigNumericFieldType: // Undefined in older versions
	// 	return "bigdecimal"
	case bigquery.GeographyFieldType:
		return "geospatial"
	// case bigquery.JSONFieldType: // Undefined in older versions
	// 	return "json"
	case bigquery.RecordFieldType:
		return "object"
	default:
		return string(bigqueryType)
	}
}

func (a *BigQueryAdapter) convertBigQueryValue(value bigquery.Value) interface{} {
	// BigQuery values are already Go types, but we might need special handling
	switch v := value.(type) {
	case bigquery.NullString:
		if v.Valid {
			return v.StringVal
		}
		return nil
	case bigquery.NullInt64:
		if v.Valid {
			return v.Int64
		}
		return nil
	case bigquery.NullFloat64:
		if v.Valid {
			return v.Float64
		}
		return nil
	case bigquery.NullBool:
		if v.Valid {
			return v.Bool
		}
		return nil
	case bigquery.NullTimestamp:
		if v.Valid {
			return v.Timestamp
		}
		return nil
	case bigquery.NullDate:
		if v.Valid {
			return v.Date
		}
		return nil
	case bigquery.NullTime:
		if v.Valid {
			return v.Time
		}
		return nil
	case bigquery.NullDateTime:
		if v.Valid {
			return v.DateTime
		}
		return nil
	// Undefined types handling removed
	/*
		case bigquery.NullNumeric:
			if v.Valid {
				return v.NumericVal
			}
			return nil
		case bigquery.NullBigNumeric:
			if v.Valid {
				return v.BigNumericVal
			}
			return nil
		case bigquery.NullGeography:
			if v.Valid {
				return v.GeographyVal
			}
			return nil
		case bigquery.NullJSON:
			if v.Valid {
				return v.JSONVal
			}
			return nil
	*/
	case []bigquery.Value:
		// Handle arrays
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = a.convertBigQueryValue(item)
		}
		return result
	default:
		return v
	}
}

// BigQueryTransaction implements a limited transaction interface
type BigQueryTransaction struct {
	adapter *BigQueryAdapter
}

func (t *BigQueryTransaction) Commit() error {
	// BigQuery doesn't support traditional transactions
	return fmt.Errorf("transactions are not supported in BigQuery")
}

func (t *BigQueryTransaction) Rollback() error {
	return fmt.Errorf("transactions are not supported in BigQuery")
}
