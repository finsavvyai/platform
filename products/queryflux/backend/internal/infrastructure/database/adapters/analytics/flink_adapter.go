package analytics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// FlinkAdapter provides connectivity to Apache Flink stream processing platform
type FlinkAdapter struct {
	conn          *entities.Connection
	baseURL       string
	jobManagerURL string
	httpClient    *http.Client
	logger        *logrus.Logger
}

// FlinkJob represents a Flink job
type FlinkJob struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	StartTime string `json:"startTime"`
}

// FlinkTable represents a Flink table schema
type FlinkTable struct {
	Name      string      `json:"name"`
	Type      string      `json:"type"`
	Connector string      `json:"connector"`
	Format    string      `json:"format"`
	Schema    interface{} `json:"schema"`
}

// FlinkQueryResult represents the result of a Flink SQL query
type FlinkQueryResult struct {
	Columns []string                 `json:"columns"`
	Rows    [][]interface{}          `json:"rows"`
	Changes []map[string]interface{} `json:"changes,omitempty"`
}

// NewFlinkAdapter creates a new Flink adapter
//
//	func NewFlinkAdapter(conn *entities.Connection) *FlinkAdapter {
//		return &FlinkAdapter{
//			conn:   conn,
//			logger: logrus.New(),
//		}
//	}
//
// Connect establishes a connection to Flink
func (a *FlinkAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Build Flink URLs
	scheme := "http"
	if conn.SSL {
		scheme = "https"
	}

	a.baseURL = fmt.Sprintf("%s://%s:%d", scheme, conn.Host, conn.Port)
	a.jobManagerURL = fmt.Sprintf("%s/v1", a.baseURL)

	// Create HTTP client
	a.httpClient = &http.Client{
		Timeout: 30 * time.Second,
	}

	// Test connection
	if err := a.testConnection(ctx); err != nil {
		return fmt.Errorf("failed to connect to Flink: %w", err)
	}

	a.logger.WithFields(logrus.Fields{
		"url":         a.baseURL,
		"job_manager": a.jobManagerURL,
	}).Info("Successfully connected to Apache Flink")

	return nil
}

// testConnection performs a simple health check
func (a *FlinkAdapter) testConnection(ctx context.Context) error {
	// Try to get Flink cluster overview
	url := fmt.Sprintf("%s/overview", a.jobManagerURL)

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
		return fmt.Errorf("Flink connection test failed with status: %d", resp.StatusCode)
	}

	return nil
}

// Disconnect closes the Flink connection
func (a *FlinkAdapter) Disconnect(ctx context.Context) error {
	if a.httpClient != nil {
		a.httpClient.CloseIdleConnections()
		a.httpClient = nil
	}
	a.logger.Info("Flink connection closed")
	return nil
}

// Shutdown closes the connection
func (a *FlinkAdapter) Shutdown(ctx context.Context) error {
	return a.Disconnect(ctx)
}

// Ping pings the database
func (a *FlinkAdapter) Ping(ctx context.Context) error {
	return a.testConnection(ctx)
}

// HealthCheck checks the health of the connection (alias for Ping)
func (a *FlinkAdapter) HealthCheck(ctx context.Context) error {
	return a.Ping(ctx)
}

// BeginTransaction starts a new transaction
func (a *FlinkAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions are not supported in Flink")
}

// TestConnection tests if the Flink connection is valid
func (a *FlinkAdapter) TestConnection(ctx context.Context) error {
	return a.testConnection(ctx)
}

// GetMetrics returns connection metrics
func (a *FlinkAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "flink",
			Version: "Unknown",
		},
	}, nil
}

// ExecuteQuery executes a Flink SQL query and returns results
func (a *FlinkAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.baseURL == "" {
		return nil, fmt.Errorf("not connected to Flink")
	}

	// Create a session for query execution
	sessionID, err := a.createSession(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create Flink session: %w", err)
	}
	defer a.deleteSession(ctx, sessionID)

	// Execute the query
	resultURL := fmt.Sprintf("%s/sessions/%s/statements/", a.baseURL, sessionID)

	queryPayload := map[string]interface{}{
		"statement": query,
	}

	// Convert to JSON
	payloadBytes, err := json.Marshal(queryPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query: %w", err)
	}

	// Execute query
	req, err := http.NewRequestWithContext(ctx, "POST", resultURL, bytes.NewBuffer(payloadBytes))
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
		return nil, fmt.Errorf("Flink query failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Flink query failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse operation handle
	var operationResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&operationResp); err != nil {
		return nil, fmt.Errorf("failed to decode operation response: %w", err)
	}

	operationHandle, ok := operationResp["operationHandle"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid operation handle in response")
	}

	// Get operation status and results
	result, err := a.getOperationResult(ctx, sessionID, operationHandle)
	if err != nil {
		return nil, fmt.Errorf("failed to get operation result: %w", err)
	}

	a.logger.WithFields(logrus.Fields{
		"session_id": sessionID,
		"rows":       len(result.Rows),
		"columns":    len(result.Columns),
		"duration":   time.Since(startTime).Milliseconds(),
	}).Debug("Flink query executed")

	// Convert columns to types.ColumnInfo
	var columns []types.ColumnInfo
	for _, colName := range result.Columns {
		columns = append(columns, types.ColumnInfo{
			Name: colName,
			Type: "string", // Flink doesn't return types in this endpoint easily
		})
	}

	return &types.QueryResult{
		Columns: columns,
		Rows:    convertFlinkRows(result.Rows, result.Columns),
		Count:   int64(len(result.Rows)),
	}, nil
}

// createSession creates a new Flink SQL Gateway session
func (a *FlinkAdapter) createSession(ctx context.Context) (string, error) {
	sessionsURL := fmt.Sprintf("%s/sessions", a.baseURL)

	sessionPayload := map[string]interface{}{
		"sessionName": fmt.Sprintf("queryflux-session-%d", time.Now().Unix()),
		"properties": map[string]string{
			"execution.checkpointing.interval": "10s",
			"execution.checkpointing.mode":     "EXACTLY_ONCE",
		},
	}

	payloadBytes, _ := json.Marshal(sessionPayload)

	req, err := http.NewRequestWithContext(ctx, "POST", sessionsURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to create session with status: %d", resp.StatusCode)
	}

	var sessionResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&sessionResp); err != nil {
		return "", err
	}

	sessionID, ok := sessionResp["sessionHandle"].(string)
	if !ok {
		return "", fmt.Errorf("no session handle in response")
	}

	return sessionID, nil
}

// deleteSession closes a Flink SQL Gateway session
func (a *FlinkAdapter) deleteSession(ctx context.Context, sessionID string) error {
	sessionsURL := fmt.Sprintf("%s/sessions/%s", a.baseURL, sessionID)

	req, err := http.NewRequestWithContext(ctx, "DELETE", sessionsURL, nil)
	if err != nil {
		return err
	}

	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// getOperationResult retrieves the result of a Flink operation
func (a *FlinkAdapter) getOperationResult(ctx context.Context, sessionID string, operationHandle map[string]interface{}) (*FlinkQueryResult, error) {
	// Extract operation handle components
	handle, ok := operationHandle["operationHandle"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid operation handle format")
	}

	handleID, _ := handle["operationId"].(string)

	// Wait for operation to complete and get results
	// In a real implementation, we should poll status until finish.
	// For now, assuming immediate return or short wait handled by server
	resultURL := fmt.Sprintf("%s/sessions/%s/operations/%s/result", a.baseURL, sessionID, handleID)

	// Polling should happen here
	time.Sleep(100 * time.Millisecond) // primitive wait

	req, err := http.NewRequestWithContext(ctx, "GET", resultURL, nil)
	if err != nil {
		return nil, err
	}

	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get operation result with status %d: %s", resp.StatusCode, string(body))
	}

	var result FlinkQueryResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetSchema retrieves schema information from Flink
func (a *FlinkAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.baseURL == "" {
		return nil, fmt.Errorf("not connected to Flink")
	}

	schema := &types.SchemaInfo{
		Tables: []types.TableInfo{},
	}

	// Get available tables from Flink catalog
	catalogsURL := fmt.Sprintf("%s/catalogs", a.jobManagerURL)
	req, err := http.NewRequestWithContext(ctx, "GET", catalogsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create catalogs request: %w", err)
	}

	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get catalogs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get catalogs with status: %d", resp.StatusCode)
	}

	// For simplicity, we'll return empty schema since Flink's catalog structure is complex
	// and would require multiple API calls to fully reconstruct
	return schema, nil
}

// GetTableInfo retrieves information about a specific Flink table
func (a *FlinkAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	if a.baseURL == "" {
		return nil, fmt.Errorf("not connected to Flink")
	}

	// Flink table info would require complex catalog API calls
	// For now, return basic table info
	return &types.TableInfo{
		Name:    tableName,
		Schema:  "default",            // Flink default catalog
		Columns: []types.ColumnInfo{}, // Would need catalog API to get actual columns
		Indexes: []types.IndexInfo{},  // Flink doesn't have traditional indexes
	}, nil
}

// IsConnected returns true if the adapter is connected
func (a *FlinkAdapter) IsConnected() bool {
	return a.baseURL != ""
}

// GetConnectionInfo returns connection information
func (a *FlinkAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// GetJobs retrieves running Flink jobs
func (a *FlinkAdapter) GetJobs(ctx context.Context) ([]FlinkJob, error) {
	if a.baseURL == "" {
		return nil, fmt.Errorf("not connected to Flink")
	}

	jobsURL := fmt.Sprintf("%s/jobs", a.jobManagerURL)
	req, err := http.NewRequestWithContext(ctx, "GET", jobsURL, nil)
	if err != nil {
		return nil, err
	}

	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get jobs with status: %d", resp.StatusCode)
	}

	var jobsResponse struct {
		Jobs []FlinkJob `json:"jobs"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&jobsResponse); err != nil {
		return nil, err
	}

	return jobsResponse.Jobs, nil
}

// SubmitJob submits a new Flink job
func (a *FlinkAdapter) SubmitJob(ctx context.Context, jarPath string, parallelism int, args []string) (string, error) {
	return "", fmt.Errorf("job submission not yet implemented")
}

// GetColumns returns a list of columns for a table
func (a *FlinkAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := a.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}

// Helper functions
func convertFlinkRows(rows [][]interface{}, columns []string) []map[string]interface{} {
	if len(rows) == 0 {
		return []map[string]interface{}{}
	}

	result := make([]map[string]interface{}, len(rows))
	for i, row := range rows {
		result[i] = make(map[string]interface{})
		for j, value := range row {
			if j < len(columns) {
				result[i][columns[j]] = value
			} else {
				result[i][fmt.Sprintf("col_%d", j)] = value
			}
		}
	}

	return result
}

func parseFlinkTime(timeStr string) time.Time {
	if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
		return t
	}
	return time.Time{}
}
