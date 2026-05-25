package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// SolrAdapter provides connectivity to Apache Solr
type SolrAdapter struct {
	conn       *entities.Connection
	httpClient *http.Client
	endpoint   string
	collection string
	logger     *logrus.Logger
}

// NewSolrAdapter creates a new Solr adapter
func NewSolrAdapter(conn *entities.Connection, logger *logrus.Logger) *SolrAdapter {
	return &SolrAdapter{
		conn:       conn,
		logger:     logger,
		collection: conn.Database,
	}
}

// Connect establishes a connection to Solr
func (a *SolrAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Build endpoint
	scheme := "https"
	if !a.conn.SSL {
		scheme = "http"
	}
	a.endpoint = fmt.Sprintf("%s://%s:%d/solr", scheme, a.conn.Host, a.conn.Port)

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

	// Test connection by getting cluster status
	_, err := a.makeRequest(ctx, "GET", "/admin/collections?action=CLUSTERSTATUS", nil)
	if err != nil {
		// Try single core status if cluster status fails
		if a.collection != "" {
			_, err = a.makeRequest(ctx, "GET", fmt.Sprintf("/%s/admin/ping", a.collection), nil)
		}
		if err != nil {
			return fmt.Errorf("failed to connect to Solr: %w", err)
		}
	}

	a.logger.Infof("Successfully connected to Apache Solr (endpoint: %s, collection: %s)", a.endpoint, a.collection)
	return nil
}

// Close closes the Solr connection
func (a *SolrAdapter) Disconnect(ctx context.Context) error {
	a.httpClient = nil
	a.logger.Info("Solr connection closed")
	return nil
}
func (a *SolrAdapter) Shutdown(ctx context.Context) error {
	return a.Disconnect(ctx)
}

// IsConnected checks if the adapter is connected
func (a *SolrAdapter) IsConnected() bool {
	return a.httpClient != nil
}

// GetConnectionInfo returns the connection info
func (a *SolrAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// ExecuteQuery executes a search query against Solr
func (a *SolrAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.httpClient == nil {
		return nil, fmt.Errorf("not connected to Solr")
	}

	startTime := time.Now()

	// Parse the query to determine the operation
	method, path, queryParams, err := a.parseQuery(query, params...)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Execute the Solr request
	resp, err := a.makeRequestWithParams(ctx, method, path, queryParams)
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

// GetSchema retrieves schema information from Solr
func (a *SolrAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.httpClient == nil {
		return nil, fmt.Errorf("not connected to Solr")
	}

	schema := &types.SchemaInfo{
		Database: a.collection,
		Tables:   make([]types.TableInfo, 0),
	}

	// Get schema for the collection/core
	if a.collection != "" {
		columns, err := a.getCollectionSchema(ctx, a.collection)
		if err != nil {
			return nil, fmt.Errorf("failed to get collection schema: %w", err)
		}

		table := types.TableInfo{
			Name:    a.collection,
			Type:    "collection",
			Columns: columns,
		}
		schema.Tables = append(schema.Tables, table)
	}

	return schema, nil
}

// GetTables returns a list of collections
func (a *SolrAdapter) GetTables(ctx context.Context) ([]string, error) {
	return a.getCollections(ctx)
}

// GetTableInfo retrieves info for a detailed table
func (a *SolrAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	columns, err := a.getCollectionSchema(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return &types.TableInfo{
		Name:    tableName,
		Columns: columns,
	}, nil
}

// GetColumns returns field information for a specific collection
func (a *SolrAdapter) GetColumns(ctx context.Context, collection string) ([]types.ColumnInfo, error) {
	return a.getCollectionSchema(ctx, collection)
}

// BeginTransaction starts a new transaction
func (a *SolrAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions are not supported in Solr")
}

// HealthCheck checks the health of the Solr connection
func (a *SolrAdapter) HealthCheck(ctx context.Context) error {
	return a.Ping(ctx)
}

// Ping pings the database
func (a *SolrAdapter) Ping(ctx context.Context) error {
	if a.httpClient == nil {
		return fmt.Errorf("not connected to Solr")
	}

	if a.collection != "" {
		_, err := a.makeRequest(ctx, "GET", fmt.Sprintf("/%s/admin/ping", a.collection), nil)
		return err
	}

	// Fallback to admin ping
	_, err := a.makeRequest(ctx, "GET", "/admin/ping", nil)
	return err
}

// TestConnection tests the connection
func (a *SolrAdapter) TestConnection(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetrics returns connection metrics
func (a *SolrAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "Solr",
			Version: "Unknown",
		},
	}, nil
}

// GetMetadata retrieves metadata about the Solr connection
func (a *SolrAdapter) GetMetadata() map[string]interface{} {
	return map[string]interface{}{
		"engine":                "solr",
		"search_engine":         true,
		"distributed":           true,
		"document_store":        true,
		"full_text_search":      true,
		"endpoint":              a.endpoint,
		"collection":            a.collection,
		"supports_transactions": false,
	}
}

// AddDocument indexes a document in Solr
func (a *SolrAdapter) AddDocument(ctx context.Context, collection string, document map[string]interface{}) error {
	if a.httpClient == nil {
		return fmt.Errorf("not connected to Solr")
	}

	body, err := json.Marshal([]map[string]interface{}{document})
	if err != nil {
		return fmt.Errorf("failed to marshal document: %w", err)
	}

	path := fmt.Sprintf("/%s/update?commit=true", collection)
	_, err = a.makeRequest(ctx, "POST", path, body)
	return err
}

// SearchDocuments performs a search query
func (a *SolrAdapter) SearchDocuments(ctx context.Context, collection string, query string, params map[string]string) (*types.QueryResult, error) {
	path := fmt.Sprintf("/%s/select", collection)

	queryParams := url.Values{}
	queryParams.Set("q", query)
	queryParams.Set("wt", "json")

	// Add additional parameters
	for key, value := range params {
		queryParams.Set(key, value)
	}

	return a.ExecuteQuery(ctx, fmt.Sprintf("SEARCH %s", path), queryParams.Encode())
}

// Helper methods

func (a *SolrAdapter) makeRequest(ctx context.Context, method, path string, body []byte) ([]byte, error) {
	url := a.endpoint + path

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add authentication
	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	// Set headers
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
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

func (a *SolrAdapter) makeRequestWithParams(ctx context.Context, method, path, queryParams string) ([]byte, error) {
	url := a.endpoint + path
	if queryParams != "" {
		url += "?" + queryParams
	}

	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add authentication
	if a.conn.Username != "" && a.conn.Password != "" {
		req.SetBasicAuth(a.conn.Username, a.conn.Password)
	}

	// Set headers
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

func (a *SolrAdapter) parseQuery(query string, params ...interface{}) (method, path string, queryParams string, err error) {
	query = strings.TrimSpace(query)

	// Handle different query types
	switch {
	case strings.HasPrefix(query, "SEARCH"):
		// Format: SEARCH /collection/select q=field:value&wt=json
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
			if len(params) > 0 {
				if qp, ok := params[0].(string); ok {
					queryParams = qp
				}
			}
		}
		method = "GET"

	case strings.HasPrefix(query, "GET"):
		// Format: GET /collection/select q=field:value&wt=json
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
			if len(params) > 0 {
				if qp, ok := params[0].(string); ok {
					queryParams = qp
				}
			}
		}
		method = "GET"

	case strings.HasPrefix(query, "POST"):
		// Format: POST /collection/update?commit=true
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
			// For POST requests, params might be the body
		}
		method = "POST"

	default:
		// Default to search query
		if a.collection != "" {
			path = fmt.Sprintf("/%s/select", a.collection)
			queryParams = "q=*:*&wt=json"
		} else {
			path = "/select"
			queryParams = "q=*:*&wt=json"
		}
		method = "GET"
	}

	return method, path, queryParams, nil
}

func (a *SolrAdapter) formatResponse(resp []byte, method string) ([]map[string]interface{}, []types.ColumnInfo) {
	var response map[string]interface{}
	if err := json.Unmarshal(resp, &response); err != nil {
		return nil, nil
	}

	var rows []map[string]interface{}
	var columns []types.ColumnInfo

	// Handle search response
	if docs, ok := response["response"].(map[string]interface{}); ok {
		if docsList, ok := docs["docs"].([]interface{}); ok {
			if len(docsList) > 0 {
				// Build columns from first document
				if firstDoc, ok := docsList[0].(map[string]interface{}); ok {
					for field := range firstDoc {
						columns = append(columns, types.ColumnInfo{
							Name: field,
							Type: "string", // Default type
						})
					}
				}

				// Process all documents
				for _, doc := range docsList {
					if docMap, ok := doc.(map[string]interface{}); ok {
						rows = append(rows, docMap)
					}
				}
			}
		}
	}

	// Default columns if no documents found
	if len(columns) == 0 {
		columns = []types.ColumnInfo{
			{Name: "response", Type: "object"},
		}
		rows = []map[string]interface{}{response}
	}

	return rows, columns
}

func (a *SolrAdapter) getCollections(ctx context.Context) ([]string, error) {
	resp, err := a.makeRequest(ctx, "GET", "/admin/collections?action=LIST", nil)
	if err != nil {
		// Fallback to cores for single-node setup
		return a.getCores(ctx)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(resp, &response); err != nil {
		return nil, err
	}

	var collections []string
	if collectionsList, ok := response["collections"].([]interface{}); ok {
		for _, collection := range collectionsList {
			if name, ok := collection.(string); ok {
				collections = append(collections, name)
			}
		}
	}

	return collections, nil
}

func (a *SolrAdapter) getCores(ctx context.Context) ([]string, error) {
	resp, err := a.makeRequest(ctx, "GET", "/admin/cores?action=STATUS", nil)
	if err != nil {
		return nil, err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(resp, &response); err != nil {
		return nil, err
	}

	var cores []string
	if status, ok := response["status"].(map[string]interface{}); ok {
		for coreName := range status {
			cores = append(cores, coreName)
		}
	}

	return cores, nil
}

func (a *SolrAdapter) getCollectionSchema(ctx context.Context, collection string) ([]types.ColumnInfo, error) {
	resp, err := a.makeRequest(ctx, "GET", fmt.Sprintf("/%s/schema/fields", collection), nil)
	if err != nil {
		return nil, err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(resp, &response); err != nil {
		return nil, err
	}

	var columns []types.ColumnInfo
	if fields, ok := response["fields"].([]interface{}); ok {
		for _, field := range fields {
			if fieldMap, ok := field.(map[string]interface{}); ok {
				name, _ := fieldMap["name"].(string)
				fieldType, _ := fieldMap["type"].(string)

				// Skip internal fields
				if strings.HasPrefix(name, "_") {
					continue
				}

				column := types.ColumnInfo{
					Name: name,
					Type: a.mapSolrType(fieldType),
				}
				columns = append(columns, column)
			}
		}
	}

	return columns, nil
}

func (a *SolrAdapter) mapSolrType(solrType string) string {
	switch solrType {
	case "string", "text_general", "text_en", "text", "text_ws":
		return "string"
	case "int", "integer", "tint":
		return "integer"
	case "long", "tlong":
		return "bigint"
	case "float", "tfloat":
		return "float"
	case "double", "tdouble":
		return "double"
	case "boolean":
		return "boolean"
	case "date", "tdate":
		return "timestamp"
	case "binary":
		return "blob"
	case "uuid":
		return "uuid"
	case "point", "location":
		return "geospatial"
	default:
		return solrType
	}
}
