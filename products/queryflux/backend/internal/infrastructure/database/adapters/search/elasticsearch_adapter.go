package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// ElasticsearchAdapter provides connectivity to Elasticsearch
type ElasticsearchAdapter struct {
	conn       *entities.Connection
	httpClient *http.Client
	endpoint   string
	username   string
	password   string
	index      string
	logger     *logrus.Logger
}

// NewElasticsearchAdapter creates a new Elasticsearch adapter
func NewElasticsearchAdapter(conn *entities.Connection, logger *logrus.Logger) *ElasticsearchAdapter {
	return &ElasticsearchAdapter{
		conn:   conn,
		logger: logger,
		index:  conn.Database,
	}
}

// Connect establishes a connection to Elasticsearch
func (a *ElasticsearchAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Build endpoint
	scheme := "https"
	if !a.conn.SSL {
		scheme = "http"
	}
	a.endpoint = fmt.Sprintf("%s://%s:%d", scheme, a.conn.Host, a.conn.Port)

	// Set authentication
	a.username = a.conn.Username
	a.password = a.conn.Password

	// Get timeout
	timeout := 30
	if val, ok := a.conn.Options["timeout"]; ok {
		if t, err := strconv.Atoi(val); err == nil {
			timeout = t
		}
	}

	// Create HTTP client with timeout
	a.httpClient = &http.Client{
		Timeout: time.Duration(timeout) * time.Second,
	}

	// Test connection by getting cluster health
	_, err := a.makeRequest(ctx, "GET", "/_cluster/health", nil)
	if err != nil {
		return fmt.Errorf("failed to connect to Elasticsearch: %w", err)
	}

	a.logger.Infof("Successfully connected to Elasticsearch (endpoint: %s)", a.endpoint)
	return nil
}

// Close closes the Elasticsearch connection
func (a *ElasticsearchAdapter) Disconnect(ctx context.Context) error {
	a.httpClient = nil
	a.logger.Info("Elasticsearch connection closed")
	return nil
}
func (a *ElasticsearchAdapter) Shutdown(ctx context.Context) error {
	return a.Disconnect(ctx)
}

// IsConnected checks if the adapter is connected
func (a *ElasticsearchAdapter) IsConnected() bool {
	return a.httpClient != nil
}

// GetConnectionInfo returns the connection info
func (a *ElasticsearchAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// ExecuteQuery executes a search query against Elasticsearch
func (a *ElasticsearchAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.httpClient == nil {
		return nil, fmt.Errorf("not connected to Elasticsearch")
	}

	startTime := time.Now()

	// Parse the query to determine the operation
	method, path, body, err := a.parseQuery(query, params...)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Execute the Elasticsearch request
	resp, err := a.makeRequest(ctx, method, path, body)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Process the response
	rows, columns := a.formatResponse(resp, method)

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

// GetSchema retrieves schema information from Elasticsearch (index mappings)
func (a *ElasticsearchAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.httpClient == nil {
		return nil, fmt.Errorf("not connected to Elasticsearch")
	}

	schema := &types.SchemaInfo{
		Database: a.index,
		Tables:   make([]types.TableInfo, 0),
	}

	// Get all indices
	indices, err := a.getIndices(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get indices: %w", err)
	}

	for _, indexName := range indices {
		// Get index mapping
		columns, err := a.getIndexMapping(ctx, indexName)
		if err != nil {
			a.logger.Warnf("Failed to get mapping for index %s: %v", indexName, err)
			continue
		}

		table := types.TableInfo{
			Name:    indexName,
			Type:    "index",
			Columns: columns,
		}
		schema.Tables = append(schema.Tables, table)
	}

	return schema, nil
}

// GetTables returns a list of indices
func (a *ElasticsearchAdapter) GetTables(ctx context.Context) ([]string, error) {
	return a.getIndices(ctx)
}

// GetTableInfo retrieves info for a detailed table
func (a *ElasticsearchAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	columns, err := a.getIndexMapping(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return &types.TableInfo{
		Name:    tableName,
		Columns: columns,
	}, nil
}

// GetColumns returns field information for a specific index
func (a *ElasticsearchAdapter) GetColumns(ctx context.Context, index string) ([]types.ColumnInfo, error) {
	return a.getIndexMapping(ctx, index)
}

// BeginTransaction starts a new transaction
func (a *ElasticsearchAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions are not supported in Elasticsearch")
}

// Ping checks the connection
func (a *ElasticsearchAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// TestConnection tests the connection
func (a *ElasticsearchAdapter) TestConnection(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// HealthCheck checks the health of the Elasticsearch cluster
func (a *ElasticsearchAdapter) HealthCheck(ctx context.Context) error {
	if a.httpClient == nil {
		return fmt.Errorf("not connected to Elasticsearch")
	}

	resp, err := a.makeRequest(ctx, "GET", "/_cluster/health", nil)
	if err != nil {
		return err
	}

	var health map[string]interface{}
	if err := json.Unmarshal(resp, &health); err != nil {
		return fmt.Errorf("failed to parse health response: %w", err)
	}

	// Check cluster status
	if status, ok := health["status"].(string); ok {
		if status == "red" {
			return fmt.Errorf("cluster health is red")
		}
	}

	return nil
}

// GetMetrics returns metrics
func (a *ElasticsearchAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if a.httpClient == nil {
		return nil, fmt.Errorf("not connected")
	}
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine: "elasticsearch",
		},
	}, nil
}

// GetMetadata retrieves metadata about the Elasticsearch cluster
func (a *ElasticsearchAdapter) GetMetadata() map[string]interface{} {
	return map[string]interface{}{
		"engine":                "elasticsearch",
		"search_engine":         true,
		"distributed":           true,
		"document_store":        true,
		"full_text_search":      true,
		"endpoint":              a.endpoint,
		"index":                 a.index,
		"supports_transactions": false,
	}
}

// IndexDocument indexes a document in Elasticsearch
func (a *ElasticsearchAdapter) IndexDocument(ctx context.Context, index string, docID string, document interface{}) error {
	if a.httpClient == nil {
		return fmt.Errorf("not connected to Elasticsearch")
	}

	body, err := json.Marshal(document)
	if err != nil {
		return fmt.Errorf("failed to marshal document: %w", err)
	}

	path := fmt.Sprintf("/%s/_doc/%s", index, docID)
	_, err = a.makeRequest(ctx, "PUT", path, body)
	return err
}

// SearchDocuments performs a search query
func (a *ElasticsearchAdapter) SearchDocuments(ctx context.Context, index string, query map[string]interface{}) (*types.QueryResult, error) {
	queryJSON, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal search query: %w", err)
	}

	path := fmt.Sprintf("/%s/_search", index)
	return a.ExecuteQuery(ctx, fmt.Sprintf("SEARCH %s", path), string(queryJSON))
}

// Helper methods

func (a *ElasticsearchAdapter) makeRequest(ctx context.Context, method, path string, body []byte) ([]byte, error) {
	url := a.endpoint + path

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add authentication
	if a.username != "" && a.password != "" {
		req.SetBasicAuth(a.username, a.password)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Make the request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errorResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errorResp)
		return nil, fmt.Errorf("HTTP %d: %v", resp.StatusCode, errorResp)
	}

	return io.ReadAll(resp.Body)
}

func (a *ElasticsearchAdapter) parseQuery(query string, params ...interface{}) (method, path string, body []byte, err error) {
	query = strings.TrimSpace(query)

	// Handle different query types
	switch {
	case strings.HasPrefix(query, "SEARCH"):
		// Format: SEARCH /index/_search {"query": {"match": {...}}}
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
			if len(params) > 0 {
				body = []byte(fmt.Sprintf("%v", params[0]))
			} else if len(parts) > 2 {
				body = []byte(strings.Join(parts[2:], " "))
			}
		}
		method = "POST"

	case strings.HasPrefix(query, "GET"):
		// Format: GET /index/_search or GET /_cluster/health
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
			if len(params) > 0 {
				// Append params as query string or body
				if strings.Contains(path, "_search") {
					body, _ = json.Marshal(params[0])
				}
			}
		}
		method = "GET"

	case strings.HasPrefix(query, "PUT"):
		// Format: PUT /index/_doc/1 {"field": "value"}
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
			if len(params) > 0 {
				body, _ = json.Marshal(params[0])
			} else if len(parts) > 2 {
				body = []byte(strings.Join(parts[2:], " "))
			}
		}
		method = "PUT"

	case strings.HasPrefix(query, "POST"):
		// Format: POST /index/_doc {"field": "value"}
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
			if len(params) > 0 {
				body, _ = json.Marshal(params[0])
			} else if len(parts) > 2 {
				body = []byte(strings.Join(parts[2:], " "))
			}
		}
		method = "POST"

	case strings.HasPrefix(query, "DELETE"):
		// Format: DELETE /index/_doc/1 or DELETE /index
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
		}
		method = "DELETE"

	default:
		// Default to search query
		if a.index != "" {
			path = fmt.Sprintf("/%s/_search", a.index)
		} else {
			path = "/_search"
		}
		method = "POST"
		if len(params) > 0 {
			body, _ = json.Marshal(params[0])
		}
	}

	return method, path, body, nil
}

func (a *ElasticsearchAdapter) formatResponse(resp []byte, method string) ([]map[string]interface{}, []types.ColumnInfo) {
	var response map[string]interface{}
	if err := json.Unmarshal(resp, &response); err != nil {
		return nil, nil
	}

	// Handle different response types
	switch method {
	case "GET":
		if strings.Contains(fmt.Sprintf("%v", response), "hits") {
			// Search response
			return a.formatSearchResponse(response)
		} else {
			// Simple response
			return []map[string]interface{}{response}, []types.ColumnInfo{{Name: "response", Type: "object"}}
		}
	default:
		// General response
		return []map[string]interface{}{response}, []types.ColumnInfo{{Name: "response", Type: "object"}}
	}
}

func (a *ElasticsearchAdapter) formatSearchResponse(response map[string]interface{}) ([]map[string]interface{}, []types.ColumnInfo) {
	var rows []map[string]interface{}
	var columns []types.ColumnInfo

	// Extract hits from search response
	if hits, ok := response["hits"].(map[string]interface{}); ok {
		if hitsList, ok := hits["hits"].([]interface{}); ok {
			if len(hitsList) > 0 {
				// Build columns from first hit
				if firstHit, ok := hitsList[0].(map[string]interface{}); ok {
					if source, ok := firstHit["_source"].(map[string]interface{}); ok {
						for field := range source {
							columns = append(columns, types.ColumnInfo{
								Name: field,
								Type: "string", // Default type
							})
						}
						// Add system fields
						columns = append(columns, []types.ColumnInfo{
							{Name: "_id", Type: "string"},
							{Name: "_index", Type: "string"},
							{Name: "_score", Type: "double"},
						}...)
					}
				}

				// Process all hits
				for _, hit := range hitsList {
					if hitMap, ok := hit.(map[string]interface{}); ok {
						row := make(map[string]interface{})

						// Add system fields
						if id, ok := hitMap["_id"]; ok {
							row["_id"] = id
						}
						if index, ok := hitMap["_index"]; ok {
							row["_index"] = index
						}
						if score, ok := hitMap["_score"]; ok {
							row["_score"] = score
						}

						// Add source fields
						if source, ok := hitMap["_source"].(map[string]interface{}); ok {
							for field, value := range source {
								row[field] = value
							}
						}

						rows = append(rows, row)
					}
				}
			}
		}
	}

	// Default columns if no hits found
	if len(columns) == 0 {
		columns = []types.ColumnInfo{
			{Name: "response", Type: "object"},
		}
	}

	return rows, columns
}

func (a *ElasticsearchAdapter) getIndices(ctx context.Context) ([]string, error) {
	resp, err := a.makeRequest(ctx, "GET", "/_cat/indices?format=json", nil)
	if err != nil {
		return nil, err
	}

	var indices []map[string]interface{}
	if err := json.Unmarshal(resp, &indices); err != nil {
		return nil, err
	}

	var indexNames []string
	for _, index := range indices {
		if name, ok := index["index"].(string); ok {
			// Skip system indices
			if !strings.HasPrefix(name, ".") {
				indexNames = append(indexNames, name)
			}
		}
	}

	return indexNames, nil
}

func (a *ElasticsearchAdapter) getIndexMapping(ctx context.Context, indexName string) ([]types.ColumnInfo, error) {
	resp, err := a.makeRequest(ctx, "GET", fmt.Sprintf("/%s/_mapping", indexName), nil)
	if err != nil {
		return nil, err
	}

	var mappings map[string]interface{}
	if err := json.Unmarshal(resp, &mappings); err != nil {
		return nil, err
	}

	var columns []types.ColumnInfo

	// Parse mapping structure
	if indexMap, ok := mappings[indexName].(map[string]interface{}); ok {
		if mappings, ok := indexMap["mappings"].(map[string]interface{}); ok {
			if properties, ok := mappings["properties"].(map[string]interface{}); ok {
				for field, fieldInfo := range properties {
					if fieldMap, ok := fieldInfo.(map[string]interface{}); ok {
						fieldType := "string"
						if ft, ok := fieldMap["type"].(string); ok {
							fieldType = a.mapElasticsearchType(ft)
						}

						column := types.ColumnInfo{
							Name:     field,
							Type:     fieldType,
							Nullable: true,
						}
						columns = append(columns, column)
					}
				}
			}
		}
	}

	// Add default system fields
	columns = append(columns, []types.ColumnInfo{
		{Name: "_id", Type: "string"},
		{Name: "_index", Type: "string"},
		{Name: "_score", Type: "double"},
	}...)

	return columns, nil
}

func (a *ElasticsearchAdapter) mapElasticsearchType(elasticType string) string {
	switch elasticType {
	case "text", "keyword":
		return "string"
	case "integer":
		return "integer"
	case "long":
		return "bigint"
	case "float":
		return "float"
	case "double":
		return "double"
	case "boolean":
		return "boolean"
	case "date":
		return "timestamp"
	case "binary":
		return "blob"
	case "object", "nested":
		return "object"
	case "array":
		return "array"
	case "ip":
		return "string"
	case "geo_point", "geo_shape":
		return "object"
	default:
		return elasticType
	}
}
