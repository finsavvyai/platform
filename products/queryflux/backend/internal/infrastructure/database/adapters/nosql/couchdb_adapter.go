package nosql

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// CouchDBAdapter implements DatabaseAdapter for CouchDB
type CouchDBAdapter struct {
	conn       *entities.Connection
	httpClient *http.Client
	baseURL    string
	connected  bool
	mutex      sync.RWMutex
	logger     *logrus.Logger
}

// Connect establishes a connection to CouchDB
func (c *CouchDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	// Update connection info
	c.conn = conn

	// Build base URL
	scheme := "http"
	if conn.SSL {
		scheme = "https"
	}

	c.baseURL = fmt.Sprintf("%s://%s:%d", scheme, conn.Host, conn.Port)

	// Initialize HTTP client if not already set
	if c.httpClient == nil {
		c.httpClient = &http.Client{}
	}

	// Test the connection
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/", nil)
	if err != nil {
		return &types.AdapterError{
			Code:    "REQUEST_CREATION_FAILED",
			Message: "Failed to create HTTP request",
			Details: err.Error(),
		}
	}

	// Add basic auth if credentials provided
	if conn.Username != "" {
		req.SetBasicAuth(conn.Username, conn.Password)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to connect to CouchDB",
			Details: err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "CouchDB connection test failed",
			Details: string(body),
		}
	}

	c.connected = true
	c.logger.Infof("Connected to CouchDB: %s", conn.Name)

	return nil
}

// Disconnect closes the CouchDB connection
func (c *CouchDBAdapter) Disconnect(ctx context.Context) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	// HTTP client doesn't need explicit disconnect
	c.baseURL = ""
	c.connected = false
	c.logger.Infof("Disconnected from CouchDB: %s", c.conn.Name)

	return nil
}

// TestConnection tests if the CouchDB connection is valid
func (c *CouchDBAdapter) TestConnection(ctx context.Context) error {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.baseURL == "" {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/", nil)
	if err != nil {
		return &types.AdapterError{
			Code:    "REQUEST_CREATION_FAILED",
			Message: "Failed to create HTTP request",
			Details: err.Error(),
		}
	}

	if c.conn.Username != "" {
		req.SetBasicAuth(c.conn.Username, c.conn.Password)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "CouchDB connection test failed",
		}
	}

	return nil
}

// ExecuteQuery executes a CouchDB query (Mango query or view)
func (c *CouchDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.baseURL == "" {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Parse query format: "database/_find" for Mango queries
	// or "database/_all_docs" for all documents
	parts := strings.SplitN(strings.TrimSpace(query), " ", 2)
	if len(parts) == 0 {
		return nil, &types.AdapterError{
			Code:    "INVALID_QUERY",
			Message: "Invalid CouchDB query format",
		}
	}

	endpoint := parts[0]
	var queryBody map[string]interface{}

	if len(parts) == 2 {
		if err := json.Unmarshal([]byte(parts[1]), &queryBody); err != nil {
			return nil, &types.AdapterError{
				Code:    "QUERY_PARSE_FAILED",
				Message: "Failed to parse CouchDB query JSON",
				Details: err.Error(),
			}
		}
	}

	// Build request
	url := c.baseURL + "/" + endpoint
	var req *http.Request
	var err error

	if queryBody != nil {
		jsonData, _ := json.Marshal(queryBody)
		req, err = http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			return nil, &types.AdapterError{
				Code:    "REQUEST_CREATION_FAILED",
				Message: "Failed to create HTTP request",
				Details: err.Error(),
			}
		}
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, err = http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, &types.AdapterError{
				Code:    "REQUEST_CREATION_FAILED",
				Message: "Failed to create HTTP request",
				Details: err.Error(),
			}
		}
	}

	if c.conn.Username != "" {
		req.SetBasicAuth(c.conn.Username, c.conn.Password)
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute CouchDB query",
			Details: err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "CouchDB query failed",
			Details: string(body),
		}
	}

	// Parse response
	var result struct {
		Docs []map[string]interface{} `json:"docs"`
		Rows []struct {
			Doc map[string]interface{} `json:"doc"`
		} `json:"rows"`
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "RESPONSE_READ_FAILED",
			Message: "Failed to read CouchDB response",
			Details: err.Error(),
		}
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, &types.AdapterError{
			Code:    "RESPONSE_PARSE_FAILED",
			Message: "Failed to parse CouchDB response",
			Details: err.Error(),
		}
	}

	// Extract documents
	var docs []map[string]interface{}
	if len(result.Docs) > 0 {
		docs = result.Docs
	} else if len(result.Rows) > 0 {
		for _, row := range result.Rows {
			docs = append(docs, row.Doc)
		}
	}

	// Extract column names from first document
	var columns []types.ColumnInfo
	if len(docs) > 0 {
		for key, value := range docs[0] {
			columns = append(columns, types.ColumnInfo{
				Name: key,
				Type: fmt.Sprintf("%T", value),
			})
		}
	}

	return &types.QueryResult{
		Columns: columns,
		Rows:    docs,
		Count:   int64(len(docs)),
	}, nil
}

// GetSchema retrieves CouchDB database schema information
func (c *CouchDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.baseURL == "" {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Get all databases
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/_all_dbs", nil)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "REQUEST_CREATION_FAILED",
			Message: "Failed to create HTTP request",
			Details: err.Error(),
		}
	}

	if c.conn.Username != "" {
		req.SetBasicAuth(c.conn.Username, c.conn.Password)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to list CouchDB databases",
			Details: err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to list CouchDB databases",
		}
	}

	var databases []string
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &databases); err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_PARSE_FAILED",
			Message: "Failed to parse CouchDB databases",
			Details: err.Error(),
		}
	}

	var tables []types.TableInfo
	for _, dbName := range databases {
		// Skip system databases
		if strings.HasPrefix(dbName, "_") {
			continue
		}

		tableInfo, err := c.GetTableInfo(ctx, dbName)
		if err != nil {
			c.logger.Warnf("Failed to get database info for %s: %v", dbName, err)
			tableInfo = &types.TableInfo{
				Name:   dbName,
				Schema: "CouchDB",
			}
		}
		tables = append(tables, *tableInfo)
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific CouchDB database
func (c *CouchDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.baseURL == "" {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Get database info
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/"+tableName, nil)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "REQUEST_CREATION_FAILED",
			Message: "Failed to create HTTP request",
			Details: err.Error(),
		}
	}

	if c.conn.Username != "" {
		req.SetBasicAuth(c.conn.Username, c.conn.Password)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_INFO_FAILED",
			Message: "Failed to get CouchDB database info",
			Details: err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, &types.AdapterError{
			Code:    "TABLE_INFO_FAILED",
			Message: "Failed to get CouchDB database info",
		}
	}

	var dbInfo struct {
		DocCount int64 `json:"doc_count"`
		DiskSize int64 `json:"disk_size"`
	}

	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &dbInfo); err != nil {
		return nil, &types.AdapterError{
			Code:    "INFO_PARSE_FAILED",
			Message: "Failed to parse CouchDB database info",
			Details: err.Error(),
		}
	}

	return &types.TableInfo{
		Name:   tableName,
		Schema: "CouchDB",
		Columns: []types.ColumnInfo{
			{
				Name: "document_count",
				Type: "integer",
			},
			{
				Name: "disk_size",
				Type: "integer",
			},
		},
	}, nil
}

// IsConnected returns true if the adapter is connected to CouchDB
func (c *CouchDBAdapter) IsConnected() bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return c.connected
}

// Shutdown closes the connection
func (c *CouchDBAdapter) Shutdown(ctx context.Context) error {
	return c.Disconnect(ctx)
}

// Ping checks the connection
func (c *CouchDBAdapter) Ping(ctx context.Context) error {
	return c.TestConnection(ctx)
}

// GetMetrics retrieves connection metrics
func (c *CouchDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{}, nil
}

// BeginTransaction starts a new transaction
func (c *CouchDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions not supported in CouchDB")
}

// GetColumns returns a list of columns for a table
func (c *CouchDBAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := c.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}

// GetConnectionInfo returns the connection information
func (c *CouchDBAdapter) GetConnectionInfo() *entities.Connection {
	return c.conn
}

// HealthCheck checks the health of the connection (alias for TestConnection)
func (c *CouchDBAdapter) HealthCheck(ctx context.Context) error {
	return c.TestConnection(ctx)
}
