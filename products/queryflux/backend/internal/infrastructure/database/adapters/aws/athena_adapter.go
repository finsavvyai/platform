package aws

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/athena"
	athenaTypes "github.com/aws/aws-sdk-go-v2/service/athena/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/sirupsen/logrus"
)

// AthenaAdapter provides connectivity to Amazon Athena
type AthenaAdapter struct {
	conn           *entities.Connection
	athenaClient   *athena.Client
	s3Client       *s3.Client
	logger         *logrus.Logger
	database       string
	outputLocation string
	workgroup      string
}

// NewAthenaAdapter creates a new Athena adapter
func NewAthenaAdapter(conn *entities.Connection) *AthenaAdapter {
	outputLocation := ""
	if val, ok := conn.Options["s3_output_location"]; ok {
		outputLocation = val
	}
	workgroup := "primary"
	if val, ok := conn.Options["workgroup"]; ok {
		workgroup = val
	}

	return &AthenaAdapter{
		conn:           conn,
		logger:         logrus.New(),
		database:       conn.Database,
		outputLocation: outputLocation,
		workgroup:      workgroup,
	}
}

// Connect establishes a connection to Amazon Athena
func (a *AthenaAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn
	if a.outputLocation == "" {
		if val, ok := conn.Options["s3_output_location"]; ok {
			a.outputLocation = val
		}
	}

	if a.outputLocation == "" {
		return fmt.Errorf("S3 output location is required for Athena queries")
	}

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
	a.athenaClient = athena.NewFromConfig(cfg)
	a.s3Client = s3.NewFromConfig(cfg)

	// Test connection by listing workgroups or databases
	_, err = a.athenaClient.ListWorkGroups(ctx, &athena.ListWorkGroupsInput{
		MaxResults: aws.Int32(1),
	})

	if err != nil {
		return fmt.Errorf("failed to connect to Athena: %w", err)
	}

	// Verify the specified database exists if provided
	if a.database != "" {
		_, err = a.athenaClient.GetDatabase(ctx, &athena.GetDatabaseInput{
			CatalogName:  aws.String("AwsDataCatalog"),
			DatabaseName: aws.String(a.database),
		})
		if err != nil {
			return fmt.Errorf("database '%s' not found or accessible: %w", a.database, err)
		}
	}

	// Verify S3 output location is accessible
	if err := a.verifyS3OutputLocation(ctx); err != nil {
		return fmt.Errorf("S3 output location verification failed: %w", err)
	}

	a.logger.Infof("Successfully connected to Amazon Athena (region: %s, database: %s)", region, a.database)
	return nil
}

// Close closes the Athena connection
func (a *AthenaAdapter) Close() error {
	a.athenaClient = nil
	a.s3Client = nil
	a.logger.Info("Athena connection closed")
	return nil
}

// Disconnect closes the Athena connection
func (a *AthenaAdapter) Disconnect(ctx context.Context) error {
	// Athena is stateless, but we might want to clean up resources if needed
	a.logger.Info("Athena connection closed")
	return nil
}

// GetConnectionInfo returns connection info
func (a *AthenaAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// TestConnection tests the connection
func (a *AthenaAdapter) TestConnection(ctx context.Context) error {
	return a.Ping(ctx)
}

// IsConnected checks if the adapter is connected
func (a *AthenaAdapter) IsConnected() bool {
	return a.athenaClient != nil && a.s3Client != nil
}

// ExecuteQuery executes a SQL query against Athena
func (a *AthenaAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.athenaClient == nil {
		return nil, fmt.Errorf("not connected to Athena")
	}

	startTime := time.Now()

	// Start query execution
	executionInput := &athena.StartQueryExecutionInput{
		QueryString: aws.String(query),
		QueryExecutionContext: &athenaTypes.QueryExecutionContext{
			Database: aws.String(a.database),
		},
		ResultConfiguration: &athenaTypes.ResultConfiguration{
			OutputLocation: aws.String(a.outputLocation),
		},
		WorkGroup: aws.String(a.workgroup),
	}

	// Add query parameters if provided
	if len(params) > 0 {
		var stringParams []string
		for _, p := range params {
			stringParams = append(stringParams, fmt.Sprintf("%v", p))
		}
		executionInput.ExecutionParameters = stringParams
	}

	// Execute the query
	executionResp, err := a.athenaClient.StartQueryExecution(ctx, executionInput)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	queryExecutionId := aws.ToString(executionResp.QueryExecutionId)

	// Wait for query completion
	_, err = a.waitForQueryCompletion(ctx, queryExecutionId)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Get query results
	rows, columns, err := a.getQueryResults(ctx, queryExecutionId)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Clean up S3 results (optional)
	defer a.cleanupQueryResults(ctx, queryExecutionId)

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

// GetSchema retrieves schema information from Athena
func (a *AthenaAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.athenaClient == nil {
		return nil, fmt.Errorf("not connected to Athena")
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
			// Get table metadata
			columns, err := a.getTableColumns(ctx, tableName)
			if err != nil {
				a.logger.Warnf("Failed to get columns for table %s: %v", tableName, err)
				continue
			}

			table := types.TableInfo{
				Name:    tableName,
				Type:    "table", // Could be VIEW, need to check
				Columns: columns,
			}
			schema.Tables = append(schema.Tables, table)
		}
	}

	return schema, nil
}

// GetTables returns a list of tables in the database
func (a *AthenaAdapter) GetTables(ctx context.Context) ([]string, error) {
	return a.listTables(ctx)
}

// GetColumns returns column information for a specific table
func (a *AthenaAdapter) GetColumns(ctx context.Context, table string) ([]types.ColumnInfo, error) {
	return a.getTableColumns(ctx, table)
}

// BeginTransaction starts a new transaction
func (a *AthenaAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions are not supported in Athena")
}

// HealthCheck checks the health of the Athena connection
func (a *AthenaAdapter) HealthCheck(ctx context.Context) error {
	return a.Ping(ctx)
}

// Ping pings the database
func (a *AthenaAdapter) Ping(ctx context.Context) error {
	if a.athenaClient == nil {
		return fmt.Errorf("not connected to Athena")
	}

	// Simple health check using a SELECT 1 query
	_, err := a.executeQuickQuery(ctx, "SELECT 1")
	return err
}

// GetMetrics returns connection metrics
func (a *AthenaAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "Athena",
			Version: "Unknown",
		},
	}, nil
}

// GetMetadata retrieves metadata about the Athena connection
func (a *AthenaAdapter) GetMetadata() map[string]interface{} {
	region := "us-east-1"
	if r, ok := a.conn.Options["region"]; ok {
		region = r
	}
	return map[string]interface{}{
		"engine":                "athena",
		"query_engine":          "presto", // Athena uses Presto
		"serverless":            true,
		"pay_per_query":         true,
		"s3_output_location":    a.outputLocation,
		"workgroup":             a.workgroup,
		"region":                region,
		"database":              a.database,
		"supports_transactions": false,
	}
}

// Helper methods

func (a *AthenaAdapter) verifyS3OutputLocation(ctx context.Context) error {
	// Parse S3 URI: s3://bucket/prefix
	if !strings.HasPrefix(a.outputLocation, "s3://") {
		return fmt.Errorf("invalid S3 output location format")
	}

	parts := strings.TrimPrefix(a.outputLocation, "s3://")
	if len(parts) == 0 {
		return fmt.Errorf("invalid S3 output location format")
	}

	slashIndex := strings.Index(parts, "/")
	if slashIndex == -1 {
		// Only bucket name, no prefix
		bucket := parts
		_, err := a.s3Client.HeadBucket(ctx, &s3.HeadBucketInput{
			Bucket: aws.String(bucket),
		})
		return err
	}

	bucket := parts[:slashIndex]
	_, err := a.s3Client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(bucket),
	})
	return err
}

func (a *AthenaAdapter) waitForQueryCompletion(ctx context.Context, queryExecutionId string) (*athena.GetQueryExecutionOutput, error) {
	for {
		result, err := a.athenaClient.GetQueryExecution(ctx, &athena.GetQueryExecutionInput{
			QueryExecutionId: aws.String(queryExecutionId),
		})
		if err != nil {
			return nil, err
		}

		status := result.QueryExecution.Status.State
		switch status {
		case athenaTypes.QueryExecutionStateSucceeded:
			return result, nil
		case athenaTypes.QueryExecutionStateFailed, athenaTypes.QueryExecutionStateCancelled:
			return nil, fmt.Errorf("query failed: %s", aws.ToString(result.QueryExecution.Status.StateChangeReason))
		case athenaTypes.QueryExecutionStateQueued, athenaTypes.QueryExecutionStateRunning:
			// Continue waiting
			time.Sleep(1 * time.Second)
		default:
			return nil, fmt.Errorf("unknown query state: %s", status)
		}
	}
}

func (a *AthenaAdapter) getQueryResults(ctx context.Context, queryExecutionId string) ([]map[string]interface{}, []types.ColumnInfo, error) {
	// Get first page of results
	result, err := a.athenaClient.GetQueryResults(ctx, &athena.GetQueryResultsInput{
		QueryExecutionId: aws.String(queryExecutionId),
	})
	if err != nil {
		return nil, nil, err
	}

	if len(result.ResultSet.Rows) == 0 {
		return []map[string]interface{}{}, []types.ColumnInfo{}, nil
	}

	// Extract column information from first row (header row)
	var columns []types.ColumnInfo
	if len(result.ResultSet.Rows[0].Data) > 0 {
		for _, col := range result.ResultSet.Rows[0].Data {
			var columnName string
			if col.VarCharValue != nil {
				columnName = aws.ToString(col.VarCharValue)
			} else {
				columnName = "_unnamed_column"
			}
			columns = append(columns, types.ColumnInfo{
				Name:     columnName,
				Type:     "string", // Athena returns all as string initially
				Nullable: true,
			})
		}
	}

	// Process data rows (skip first row which is headers)
	var rows []map[string]interface{}
	for i, row := range result.ResultSet.Rows {
		if i == 0 {
			continue // Skip header row
		}

		rowMap := make(map[string]interface{})
		for j, datum := range row.Data {
			if j < len(columns) {
				var value interface{} = nil
				if datum.VarCharValue != nil {
					value = aws.ToString(datum.VarCharValue)
				}
				rowMap[columns[j].Name] = value
			}
		}
		rows = append(rows, rowMap)
	}

	// Get remaining pages if any
	for result.NextToken != nil {
		nextResult, err := a.athenaClient.GetQueryResults(ctx, &athena.GetQueryResultsInput{
			QueryExecutionId: aws.String(queryExecutionId),
			NextToken:        result.NextToken,
		})
		if err != nil {
			break
		}

		for _, row := range nextResult.ResultSet.Rows {
			rowMap := make(map[string]interface{})
			for j, datum := range row.Data {
				if j < len(columns) {
					var value interface{} = nil
					if datum.VarCharValue != nil {
						value = aws.ToString(datum.VarCharValue)
					}
					rowMap[columns[j].Name] = value
				}
			}
			rows = append(rows, rowMap)
		}

		result.NextToken = nextResult.NextToken
	}

	return rows, columns, nil
}

func (a *AthenaAdapter) listTables(ctx context.Context) ([]string, error) {
	if a.database == "" {
		return nil, fmt.Errorf("database not specified")
	}

	var tables []string
	input := &athena.ListTableMetadataInput{
		CatalogName:  aws.String("AwsDataCatalog"),
		DatabaseName: aws.String(a.database),
		MaxResults:   aws.Int32(100),
	}

	for {
		resp, err := a.athenaClient.ListTableMetadata(ctx, input)
		if err != nil {
			return nil, fmt.Errorf("failed to list tables: %w", err)
		}

		for _, table := range resp.TableMetadataList {
			tables = append(tables, aws.ToString(table.Name))
		}

		if resp.NextToken == nil {
			break
		}
		input.NextToken = resp.NextToken
	}

	return tables, nil
}

func (a *AthenaAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	// Use DESCRIBE or INFORMATION_SCHEMA to get column information
	query := fmt.Sprintf("DESCRIBE %s", tableName)
	result, err := a.executeQuickQuery(ctx, query)
	if err != nil {
		// Fallback to INFORMATION_SCHEMA
		query = fmt.Sprintf(`
			SELECT column_name, data_type
			FROM information_schema.columns
			WHERE table_schema = '%s' AND table_name = '%s'
			ORDER BY ordinal_position
		`, a.database, tableName)
		result, err = a.executeQuickQuery(ctx, query)
		if err != nil {
			return nil, fmt.Errorf("failed to get table columns: %w", err)
		}
	}

	var columns []types.ColumnInfo
	for _, row := range result.Rows {
		columnName, ok := row["col_name"].(string)
		if !ok {
			columnName, ok = row["column_name"].(string)
		}
		if !ok {
			continue
		}

		dataType, _ := row["data_type"].(string)
		if dataType == "" {
			// Try other possible column names
			if dt, ok := row["type"].(string); ok {
				dataType = dt
			}
		}

		column := types.ColumnInfo{
			Name:     columnName,
			Type:     a.mapAthenaType(dataType),
			Nullable: true, // Assume nullable by default
		}
		columns = append(columns, column)
	}

	return columns, nil
}

// GetTableInfo retrieves table info
func (a *AthenaAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	columns, err := a.GetColumns(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return &types.TableInfo{
		Name:    tableName,
		Schema:  a.database,
		Columns: columns,
	}, nil
}

func (a *AthenaAdapter) executeQuickQuery(ctx context.Context, query string) (*types.QueryResult, error) {
	return a.ExecuteQuery(ctx, query)
}

func (a *AthenaAdapter) mapAthenaType(athenaType string) string {
	// Map Athena types to standard types
	switch strings.ToLower(athenaType) {
	case "varchar", "string", "char":
		return "string"
	case "integer", "int", "tinyint", "smallint":
		return "integer"
	case "bigint":
		return "bigint"
	case "double", "float", "real":
		return "double"
	case "boolean":
		return "boolean"
	case "timestamp", "timestamp with time zone":
		return "timestamp"
	case "date":
		return "date"
	case "array":
		return "array"
	case "map":
		return "object"
	case "row", "struct":
		return "object"
	case "decimal":
		return "decimal"
	case "binary":
		return "blob"
	default:
		return athenaType
	}
}

func (a *AthenaAdapter) cleanupQueryResults(ctx context.Context, queryExecutionId string) {
	// Optional: Clean up S3 results
	// This would parse the output location and delete the results files
	// For now, we'll leave this as a placeholder
	a.logger.Debugf("Skipping cleanup of query results for %s", queryExecutionId)
}
