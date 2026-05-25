package aws

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/timestreamquery"
	timestreamQueryTypes "github.com/aws/aws-sdk-go-v2/service/timestreamquery/types"
	"github.com/aws/aws-sdk-go-v2/service/timestreamwrite"
	timestreamWriteTypes "github.com/aws/aws-sdk-go-v2/service/timestreamwrite/types"
	"github.com/sirupsen/logrus"
)

// TimestreamAdapter provides connectivity to Amazon Timestream
type TimestreamAdapter struct {
	conn        *entities.Connection
	queryClient *timestreamquery.Client
	writeClient *timestreamwrite.Client
	logger      *logrus.Logger
	database    string
}

// NewTimestreamAdapter creates a new Timestream adapter
func NewTimestreamAdapter(conn *entities.Connection) *TimestreamAdapter {
	return &TimestreamAdapter{
		conn:     conn,
		logger:   logrus.New(),
		database: conn.Database,
	}
}

// Connect establishes a connection to Amazon Timestream
func (a *TimestreamAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn
	a.database = conn.Database

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Configure region
	region := "us-east-1"
	if r, ok := a.conn.Options["region"]; ok {
		region = r
	}
	cfg.Region = region

	// Create clients
	a.queryClient = timestreamquery.NewFromConfig(cfg)
	a.writeClient = timestreamwrite.NewFromConfig(cfg)

	// Test connection by listing databases using Write Client
	_, err = a.writeClient.ListDatabases(ctx, &timestreamwrite.ListDatabasesInput{
		MaxResults: aws.Int32(1),
	})

	if err != nil {
		return fmt.Errorf("failed to connect to Timestream: %w", err)
	}

	// Verify the specified database exists if provided
	if a.database != "" {
		_, err = a.writeClient.DescribeDatabase(ctx, &timestreamwrite.DescribeDatabaseInput{
			DatabaseName: aws.String(a.database),
		})
		if err != nil {
			return fmt.Errorf("database '%s' not found or accessible: %w", a.database, err)
		}
	}

	a.logger.Infof("Successfully connected to Amazon Timestream (region: %s)", region)
	return nil
}

// Close closes the Timestream connection
func (a *TimestreamAdapter) Close() error {
	a.queryClient = nil
	a.writeClient = nil
	a.logger.Info("Timestream connection closed")
	return nil
}

// Disconnect implements DatabaseAdapter
func (a *TimestreamAdapter) Disconnect(ctx context.Context) error {
	return a.Close()
}

// IsConnected checks if the adapter is connected
func (a *TimestreamAdapter) IsConnected() bool {
	return a.queryClient != nil && a.writeClient != nil
}

// GetConnectionInfo returns connection info
func (a *TimestreamAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// ExecuteQuery executes a SQL query against Timestream
func (a *TimestreamAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.queryClient == nil {
		return nil, fmt.Errorf("not connected to Timestream")
	}

	startTime := time.Now()

	// Execute the query
	result, err := a.queryClient.Query(ctx, &timestreamquery.QueryInput{
		QueryString: aws.String(query),
	})

	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Process the query results
	var rows []map[string]interface{}
	var columns []types.ColumnInfo

	if result.ColumnInfo != nil && result.Rows != nil {
		// Build column information
		columns = make([]types.ColumnInfo, len(result.ColumnInfo))
		for i, col := range result.ColumnInfo {
			columns[i] = types.ColumnInfo{
				Name:     aws.ToString(col.Name),
				Type:     a.mapTimestreamType(col.Type),
				Nullable: true, // Timestream columns can be null
			}
		}

		// Process rows
		for _, row := range result.Rows {
			rowMap := make(map[string]interface{})

			for i, datum := range row.Data {
				colInfo := result.ColumnInfo[i]
				value := a.parseDatum(&datum, colInfo.Type)

				if colInfo.Name != nil {
					rowMap[aws.ToString(colInfo.Name)] = value
				}
			}

			rows = append(rows, rowMap)
		}
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

// GetSchema retrieves schema information from Timestream
func (a *TimestreamAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.writeClient == nil {
		return nil, fmt.Errorf("not connected to Timestream")
	}

	schema := &types.SchemaInfo{
		Database: a.database,
		Tables:   make([]types.TableInfo, 0),
	}

	// List all tables in the database
	if a.database != "" {
		tables, err := a.listTables(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list tables: %w", err)
		}

		for _, tableName := range tables {
			table := types.TableInfo{
				Name:    tableName,
				Type:    "time_series_table",
				Columns: a.getDefaultTimeSeriesColumns(),
			}
			schema.Tables = append(schema.Tables, table)
		}
	}

	return schema, nil
}

// GetTables returns a list of tables in the database
func (a *TimestreamAdapter) GetTables(ctx context.Context) ([]string, error) {
	return a.listTables(ctx)
}

// GetTableInfo retrieves info for a detailed table
func (a *TimestreamAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	return &types.TableInfo{
		Name:    tableName,
		Type:    "time_series_table",
		Columns: a.getDefaultTimeSeriesColumns(),
	}, nil
}

// GetColumns returns column information for a specific table
func (a *TimestreamAdapter) GetColumns(ctx context.Context, table string) ([]types.ColumnInfo, error) {
	// Timestream doesn't have a fixed schema
	// Return default time series columns
	return a.getDefaultTimeSeriesColumns(), nil
}

// BeginTransaction starts a new transaction
func (a *TimestreamAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions are not supported in Timestream")
}

// HealthCheck checks the health of the Timestream connection
func (a *TimestreamAdapter) HealthCheck(ctx context.Context) error {
	if a.queryClient == nil {
		return fmt.Errorf("not connected to Timestream")
	}

	// Simple health check using a SELECT 1 query
	_, err := a.queryClient.Query(ctx, &timestreamquery.QueryInput{
		QueryString: aws.String("SELECT 1"),
	})

	return err
}

// Ping checks the connection
func (a *TimestreamAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// TestConnection checks the connection
func (a *TimestreamAdapter) TestConnection(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetrics returns connection metrics
func (a *TimestreamAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine: "timestream",
		},
	}, nil
}

// GetMetadata retrieves metadata about the Timestream connection
func (a *TimestreamAdapter) GetMetadata() map[string]interface{} {
	region := "us-east-1"
	if r, ok := a.conn.Options["region"]; ok {
		region = r
	}
	return map[string]interface{}{
		"engine":                "timestream",
		"time_series_db":        true,
		"serverless":            true,
		"automated_retention":   true,
		"region":                region,
		"database":              a.database,
		"supports_transactions": false,
	}
}

// WriteRecords writes time series records to Timestream
func (a *TimestreamAdapter) WriteRecords(ctx context.Context, tableName string, records []TimeSeriesRecord) error {
	if a.writeClient == nil {
		return fmt.Errorf("not connected to Timestream")
	}

	// Convert records to Timestream format
	timestreamRecords := make([]timestreamWriteTypes.Record, len(records))
	for i, record := range records {
		dimensions := make([]timestreamWriteTypes.Dimension, len(record.Dimensions))
		for j, dim := range record.Dimensions {
			dimensions[j] = timestreamWriteTypes.Dimension{
				Name:  aws.String(dim.Name),
				Value: aws.String(dim.Value),
			}
		}

		timestreamRecords[i] = timestreamWriteTypes.Record{
			Dimensions:       dimensions,
			MeasureName:      aws.String(record.MeasureName),
			MeasureValue:     aws.String(record.MeasureValue),
			MeasureValueType: timestreamWriteTypes.MeasureValueType(record.MeasureValueType),
			Time:             aws.String(fmt.Sprintf("%d", record.Time.Unix())),
			TimeUnit:         timestreamWriteTypes.TimeUnitSeconds,
		}
	}

	// Write records
	_, err := a.writeClient.WriteRecords(ctx, &timestreamwrite.WriteRecordsInput{
		DatabaseName: aws.String(a.database),
		TableName:    aws.String(tableName),
		Records:      timestreamRecords,
	})

	return err
}

// Helper methods

func (a *TimestreamAdapter) listTables(ctx context.Context) ([]string, error) {
	if a.database == "" {
		return nil, fmt.Errorf("database not specified")
	}

	var tables []string
	listTablesInput := &timestreamwrite.ListTablesInput{
		DatabaseName: aws.String(a.database),
		MaxResults:   aws.Int32(100),
	}

	for {
		resp, err := a.writeClient.ListTables(ctx, listTablesInput)
		if err != nil {
			return nil, fmt.Errorf("failed to list tables: %w", err)
		}

		for _, table := range resp.Tables {
			tables = append(tables, aws.ToString(table.TableName))
		}

		if resp.NextToken == nil {
			break
		}
		listTablesInput.NextToken = resp.NextToken
	}

	return tables, nil
}

func (a *TimestreamAdapter) getDefaultTimeSeriesColumns() []types.ColumnInfo {
	return []types.ColumnInfo{
		{Name: "time", Type: "timestamp", Nullable: false},
		{Name: "measure_name", Type: "string", Nullable: false},
		{Name: "measure_value", Type: "string", Nullable: true}, // Can be various types
		{Name: "measure_value_type", Type: "string", Nullable: true},
	}
}

func (a *TimestreamAdapter) mapTimestreamType(columnType *timestreamQueryTypes.Type) string {
	if columnType == nil {
		return "unknown"
	}

	switch columnType.ScalarType {
	case timestreamQueryTypes.ScalarTypeVarchar:
		return "string"
	case timestreamQueryTypes.ScalarTypeBigint:
		return "bigint"
	case timestreamQueryTypes.ScalarTypeDouble:
		return "double"
	case timestreamQueryTypes.ScalarTypeBoolean:
		return "boolean"
	case timestreamQueryTypes.ScalarTypeTimestamp:
		return "timestamp"
	case timestreamQueryTypes.ScalarTypeDate:
		return "date"
	case timestreamQueryTypes.ScalarTypeTime:
		return "time"
	case timestreamQueryTypes.ScalarTypeInteger:
		return "integer"
	// case timestreamQueryTypes.ScalarTypeArray:
	// 	return "array"
	// case timestreamQueryTypes.ScalarTypeRow:
	// 	return "object"
	default:
		return "unknown"
	}
}

func (a *TimestreamAdapter) parseDatum(datum *timestreamQueryTypes.Datum, columnType *timestreamQueryTypes.Type) interface{} {
	if datum == nil {
		return nil
	}

	if columnType == nil {
		if datum.ScalarValue != nil {
			return aws.ToString(datum.ScalarValue)
		}
		return nil
	}

	// Check for Array type
	if columnType.ArrayColumnInfo != nil {
		if len(datum.ArrayValue) > 0 {
			result := make([]interface{}, len(datum.ArrayValue))
			for i, element := range datum.ArrayValue {
				// Recursively parse elements. Inner type is in ArrayColumnInfo.
				result[i] = a.parseDatum(&element, columnType.ArrayColumnInfo.Type)
			}
			return result
		}
		return []interface{}{}
	}

	// Check for Row type
	if len(columnType.RowColumnInfo) > 0 {
		if datum.RowValue != nil {
			result := make(map[string]interface{})
			// RowColumnInfo contains the schema for the row
			for i, data := range datum.RowValue.Data {
				if i < len(columnType.RowColumnInfo) {
					colInfo := columnType.RowColumnInfo[i]
					colName := aws.ToString(colInfo.Name)
					if colName == "" {
						colName = fmt.Sprintf("field_%d", i)
					}
					result[colName] = a.parseDatum(&data, colInfo.Type)
				}
			}
			return result
		}
		return map[string]interface{}{}
	}

	switch columnType.ScalarType {
	case timestreamQueryTypes.ScalarTypeVarchar:
		return aws.ToString(datum.ScalarValue)
	case timestreamQueryTypes.ScalarTypeBigint, timestreamQueryTypes.ScalarTypeInteger:
		if datum.ScalarValue != nil {
			// Parse as int64
			if val, err := fmt.Sscanf(*datum.ScalarValue, "%d", new(int64)); err == nil && val == 1 {
				var result int64
				fmt.Sscanf(*datum.ScalarValue, "%d", &result)
				return result
			}
		}
		return aws.ToString(datum.ScalarValue)
	case timestreamQueryTypes.ScalarTypeDouble:
		if datum.ScalarValue != nil {
			// Parse as float64
			if val, err := fmt.Sscanf(*datum.ScalarValue, "%f", new(float64)); err == nil && val == 1 {
				var result float64
				fmt.Sscanf(*datum.ScalarValue, "%f", &result)
				return result
			}
		}
		return aws.ToString(datum.ScalarValue)
	case timestreamQueryTypes.ScalarTypeBoolean:
		return aws.ToString(datum.ScalarValue) == "true"
	case timestreamQueryTypes.ScalarTypeTimestamp:
		if datum.ScalarValue != nil {
			if parsed, err := time.Parse(time.RFC3339, *datum.ScalarValue); err == nil {
				return parsed
			}
		}
		return aws.ToString(datum.ScalarValue)
	}

	return aws.ToString(datum.ScalarValue)
}

// TimeSeriesRecord represents a time series data point
type TimeSeriesRecord struct {
	Time             time.Time
	MeasureName      string
	MeasureValue     string
	MeasureValueType string
	Dimensions       []Dimension
}

// Dimension represents a time series dimension
type Dimension struct {
	Name  string
	Value string
}
