package analytics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// DruidAdapter provides connectivity to Apache Druid real-time analytics database
type DruidAdapter struct {
	conn       *entities.Connection
	baseURL    string
	httpClient *http.Client
	logger     *logrus.Logger
}

// DruidQueryResponse represents the response from Druid query API
type DruidQueryResponse struct {
	QueryType string            `json:"queryType"`
	QueryID   string            `json:"queryId"`
	ResultSet []json.RawMessage `json:"result"`
	NumRows   int               `json:"numRows"`
	Timestamp string            `json:"timestamp"`
}

// DruidColumn represents Druid column metadata
type DruidColumn struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	SQLType string `json:"sqlType"`
}

// DruidTable represents Druid datasource metadata
type DruidTable struct {
	Name    string        `json:"name"`
	Type    string        `json:"type"`
	Columns []DruidColumn `json:"columns"`
}

// NewDruidAdapter creates a new Druid adapter
//
//	func NewDruidAdapter(conn *entities.Connection) *DruidAdapter {
//		return &DruidAdapter{
//			conn:   conn,
//			logger: logrus.New(),
//		}
//	}
//
// Connect establishes a connection to Druid
func (a *DruidAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Build Druid URL
	scheme := "http"
	if conn.SSL {
		scheme = "https"
	}

	a.baseURL = fmt.Sprintf("%s://%s:%d", scheme, conn.Host, conn.Port)

	// Create HTTP client
	a.httpClient = &http.Client{
		Timeout: 30 * time.Second,
	}

	// Test connection with a simple query
	if err := a.testConnection(ctx); err != nil {
		return fmt.Errorf("failed to connect to Druid: %w", err)
	}

	a.logger.WithFields(logrus.Fields{
		"url": a.baseURL,
	}).Info("Successfully connected to Apache Druid")

	return nil
}

// testConnection performs a simple health check
func (a *DruidAdapter) testConnection(ctx context.Context) error {
	// Try to get datasources list
	url := fmt.Sprintf("%s/druid/v2/datasources", a.baseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	// Add authentication if provided
	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Druid connection test failed with status: %d", resp.StatusCode)
	}

	return nil
}

// Disconnect closes the Druid connection
func (a *DruidAdapter) Disconnect(ctx context.Context) error {
	if a.httpClient != nil {
		a.httpClient.CloseIdleConnections()
		a.httpClient = nil
	}
	a.logger.Info("Druid connection closed")
	return nil
}

// Shutdown closes the connection
func (a *DruidAdapter) Shutdown(ctx context.Context) error {
	return a.Disconnect(ctx)
}

// Ping pings the database
func (a *DruidAdapter) Ping(ctx context.Context) error {
	return a.testConnection(ctx)
}

// HealthCheck checks the health of the connection (alias for TestConnection)
func (a *DruidAdapter) HealthCheck(ctx context.Context) error {
	return a.Ping(ctx)
}

// TestConnection tests if the Druid connection is valid
func (a *DruidAdapter) TestConnection(ctx context.Context) error {
	return a.testConnection(ctx)
}

// GetMetrics returns connection metrics
func (a *DruidAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "druid",
			Version: "Unknown",
		},
	}, nil
}

// BeginTransaction starts a new transaction
func (a *DruidAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions are not supported in Druid")
}

// ExecuteQuery executes a Druid query and returns results
func (a *DruidAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.baseURL == "" {
		return nil, fmt.Errorf("not connected to Druid")
	}

	// Prepare Druid SQL query
	queryPayload := map[string]interface{}{
		"query": query,
	}

	// If there are parameters, prepare a parameterized query
	if len(params) > 0 {
		// Druid supports parameterized queries through context
		queryPayload["context"] = map[string]interface{}{
			"sqlQueryId": fmt.Sprintf("query_%d", time.Now().Unix()),
		}
	}

	// Convert to JSON
	payloadBytes, err := json.Marshal(queryPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query: %w", err)
	}

	// Execute query
	url := fmt.Sprintf("%s/druid/v2/sql/", a.baseURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Add authentication
	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	// Add headers for parameters if needed
	if len(params) > 0 {
		for i, param := range params {
			req.Header.Set(fmt.Sprintf("X-Param-%d", i+1), fmt.Sprintf("%v", param))
		}
	}

	startTime := time.Now()
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Druid query failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Druid query failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	// Druid SQL API returns an array of objects directly? Or wrapped?
	// The documentation says: [ { "col1": val1, ... }, ... ]
	// But the struct DruidQueryResponse assumes wrapped.
	// Let's check how it worked before.
	// Original code used DruidQueryResponse with ResultSet []json.RawMessage.
	// Wait, standard Druid SQL returns List of Maps.
	// If the original code was working or intended to work, let's stick to it, but verify assumption.
	// Actually, if it returns [ {}, {} ], `json.NewDecoder(resp.Body).Decode(&druidResp)` would FAIL if `druidResp` is a struct and response is array.
	// I'll try decoding into []map[string]interface{} first, which is safer for Druid SQL.

	var rows []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		// Try error response
		// return nil, fmt.Errorf("failed to decode Druid response: %w", err)
		// Maybe it is DruidQueryResponse style?
		// Re-read body? No, stream consumed.
		// For safety, let's assume standard Druid SQL API which returns array of objects.
		return nil, fmt.Errorf("failed to decode Druid response as array of objects: %w", err)
	}

	if len(rows) == 0 {
		return &types.QueryResult{
			Columns: []types.ColumnInfo{},
			Rows:    []map[string]interface{}{},
			Count:   0,
		}, nil
	}

	// Extract column names and types from first row
	// Since JSON doesn't preserve types perfectly (numbers are float64), we might guess or leave as unknown
	var columns []types.ColumnInfo
	// Get keys from first row
	firstRow := rows[0]
	for k := range firstRow {
		columns = append(columns, types.ColumnInfo{
			Name: k,
			Type: "string", // Default since we don't have schema
		})
	}

	a.logger.WithFields(logrus.Fields{
		"rows":     len(rows),
		"columns":  len(columns),
		"duration": time.Since(startTime).Milliseconds(),
	}).Debug("Druid query executed")

	return &types.QueryResult{
		Columns: columns,
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}

// GetSchema retrieves schema information from Druid
func (a *DruidAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.baseURL == "" {
		return nil, fmt.Errorf("not connected to Druid")
	}

	schema := &types.SchemaInfo{
		Tables: []types.TableInfo{},
	}

	// Get all datasources
	url := fmt.Sprintf("%s/druid/v2/datasources?include=columns", a.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add authentication
	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get datasources: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get datasources with status: %d", resp.StatusCode)
	}

	var datasources []DruidTable
	if err := json.NewDecoder(resp.Body).Decode(&datasources); err != nil {
		return nil, fmt.Errorf("failed to decode datasources: %w", err)
	}

	// Convert to TableInfo format
	for _, ds := range datasources {
		columns := make([]types.ColumnInfo, len(ds.Columns))
		for i, col := range ds.Columns {
			columns[i] = types.ColumnInfo{
				Name:         col.Name,
				Type:         col.Type,
				Nullable:     true, // Druid columns are generally nullable
				DefaultValue: "",
				IsPrimaryKey: false, // Druid doesn't have traditional primary keys
			}
		}

		tableInfo := types.TableInfo{
			Name:    ds.Name,
			Schema:  "druid", // Druid doesn't have traditional schemas
			Columns: columns,
			Indexes: []types.IndexInfo{}, // Druid doesn't have traditional indexes
		}

		schema.Tables = append(schema.Tables, tableInfo)
	}

	return schema, nil
}

// GetTableInfo retrieves information about a specific Druid datasource
func (a *DruidAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	if a.baseURL == "" {
		return nil, fmt.Errorf("not connected to Druid")
	}

	// Get specific datasource with columns
	url := fmt.Sprintf("%s/druid/v2/datasources/%s?include=columns", a.baseURL, url.PathEscape(tableName))
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add authentication
	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get datasource: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("datasource %s not found", tableName)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get datasource with status: %d", resp.StatusCode)
	}

	var datasource DruidTable
	if err := json.NewDecoder(resp.Body).Decode(&datasource); err != nil {
		return nil, fmt.Errorf("failed to decode datasource: %w", err)
	}

	// Convert to TableInfo format
	columns := make([]types.ColumnInfo, len(datasource.Columns))
	for i, col := range datasource.Columns {
		columns[i] = types.ColumnInfo{
			Name:         col.Name,
			Type:         col.Type,
			Nullable:     true, // Druid columns are generally nullable
			DefaultValue: "",
			IsPrimaryKey: false, // Druid doesn't have traditional primary keys
		}
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  "druid", // Druid doesn't have traditional schemas
		Columns: columns,
		Indexes: []types.IndexInfo{}, // Druid doesn't have traditional indexes
	}, nil
}

// IsConnected returns true if the adapter is connected
func (a *DruidAdapter) IsConnected() bool {
	return a.baseURL != ""
}

// GetConnectionInfo returns connection information
func (a *DruidAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// GetCoordinatorURL returns the Druid coordinator URL
func (a *DruidAdapter) GetCoordinatorURL() string {
	return a.baseURL
}

// ExecuteNativeQuery executes a native Druid query (non-SQL)
func (a *DruidAdapter) ExecuteNativeQuery(ctx context.Context, queryType string, query map[string]interface{}) (*types.QueryResult, error) {
	if a.baseURL == "" {
		return nil, fmt.Errorf("not connected to Druid")
	}

	// Add query type
	query["queryType"] = queryType

	// Convert to JSON
	payloadBytes, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal native query: %w", err)
	}

	// Execute native query
	url := fmt.Sprintf("%s/druid/v2/", a.baseURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Add authentication
	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	startTime := time.Now()
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Druid native query failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Druid native query failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response (this will vary by query type, so we return as raw JSON)
	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode native query response: %w", err)
	}

	a.logger.WithFields(logrus.Fields{
		"query_type": queryType,
		"duration":   time.Since(startTime).Milliseconds(),
	}).Debug("Druid native query executed")

	// Convert to our format - for native queries, we return the result as a single row with JSON
	resultJSON, _ := json.Marshal(result)
	return &types.QueryResult{
		Columns: []types.ColumnInfo{{Name: "result", Type: "json"}},
		Rows: []map[string]interface{}{
			{"result": json.RawMessage(resultJSON)},
		},
		Count: 1,
	}, nil
}

// GetColumns returns a list of columns for a table
func (a *DruidAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := a.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}
