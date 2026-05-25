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
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/base"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// TypesenseAdapter provides connectivity to Typesense search engine
type TypesenseAdapter struct {
	base       *base.EnhancedBaseAdapter
	conn       *entities.Connection
	httpClient *http.Client
	endpoint   string
	apiKey     string
	logger     *logrus.Logger
}

// NewTypesenseAdapter creates a new Typesense adapter
func NewTypesenseAdapter(conn *entities.Connection, logger *logrus.Logger) *TypesenseAdapter {
	return &TypesenseAdapter{
		conn:   conn,
		logger: logger,
	}
}

// Connect establishes a connection to Typesense
func (a *TypesenseAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Initialize base adapter
	a.base = base.NewEnhancedBaseAdapter(conn, a.logger)

	// Build endpoint
	scheme := "https"
	if !a.conn.SSL {
		scheme = "http"
	}
	a.endpoint = fmt.Sprintf("%s://%s:%d", scheme, a.conn.Host, a.conn.Port)

	// Set API key
	a.apiKey = a.conn.Password // Use password field for API key

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

	// Test connection by getting health
	_, err := a.makeRequest(ctx, "GET", "/health", nil)
	if err != nil {
		return a.base.CreateError("CONNECTION_FAILED", "Failed to connect to Typesense", err.Error(), "")
	}

	a.logger.Infof("Successfully connected to Typesense (endpoint: %s)", a.endpoint)
	return nil
}

// Close closes the Typesense connection
func (a *TypesenseAdapter) Disconnect(ctx context.Context) error {
	if a.base != nil {
		a.base.Close()
	}
	a.httpClient = nil
	a.logger.Info("Typesense connection closed")
	return nil
}

func (a *TypesenseAdapter) Shutdown(ctx context.Context) error {
	return a.Disconnect(ctx)
}

// IsConnected checks if the adapter is connected
func (a *TypesenseAdapter) IsConnected() bool {
	return a.httpClient != nil
}

// GetConnectionInfo returns the connection info
func (a *TypesenseAdapter) GetConnectionInfo() *entities.Connection {
	if a.base != nil {
		return a.base.GetConnection()
	}
	return a.conn
}

// ExecuteQuery executes a search query against Typesense
func (a *TypesenseAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.httpClient == nil {
		return nil, fmt.Errorf("not connected to Typesense")
	}

	var start time.Time
	if a.base != nil {
		start = a.base.TrackQueryStart(query)
	} else {
		start = time.Now()
	}

	// Parse the query to determine the operation
	method, path, body, err := a.parseQuery(query, params...)
	if err != nil {
		if a.base != nil {
			a.base.TrackQueryEnd(start, false, err)
		}
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(start).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Execute the Typesense request
	resp, err := a.makeRequest(ctx, method, path, body)

	if a.base != nil {
		a.base.TrackQueryEnd(start, err == nil, err)
	}

	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(start).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	// Process the response
	rows, columns := a.formatResponse(resp, method)

	executionTime := time.Since(start)

	return &types.QueryResult{
		Query:         query,
		Rows:          rows,
		Columns:       columns,
		RowsAffected:  int64(len(rows)),
		ExecutionTime: executionTime.Milliseconds(),
		Success:       true,
	}, nil
}

// GetSchema retrieves schema information from Typesense (collections)
func (a *TypesenseAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.httpClient == nil {
		return nil, fmt.Errorf("not connected to Typesense")
	}

	schema := &types.SchemaInfo{
		Database: a.conn.Database,
		Tables:   make([]types.TableInfo, 0),
	}

	// Get all collections
	collections, err := a.getCollections(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get collections: %w", err)
	}

	for _, collectionName := range collections {
		// Get collection schema
		columns, err := a.getCollectionSchema(ctx, collectionName)
		if err != nil {
			a.logger.Warnf("Failed to get schema for collection %s: %v", collectionName, err)
			continue
		}

		table := types.TableInfo{
			Name:    collectionName,
			Type:    "collection",
			Columns: columns,
		}
		schema.Tables = append(schema.Tables, table)
	}

	return schema, nil
}

// GetTables returns a list of collections
func (a *TypesenseAdapter) GetTables(ctx context.Context) ([]string, error) {
	return a.getCollections(ctx)
}

// GetTableInfo retrieves info for a detailed table
func (a *TypesenseAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
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
func (a *TypesenseAdapter) GetColumns(ctx context.Context, collection string) ([]types.ColumnInfo, error) {
	return a.getCollectionSchema(ctx, collection)
}

// BeginTransaction starts a new transaction
func (a *TypesenseAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions are not supported in Typesense")
}

// HealthCheck checks the health of the Typesense connection
func (a *TypesenseAdapter) HealthCheck(ctx context.Context) error {
	return a.Ping(ctx)
}

// Ping pings the database
func (a *TypesenseAdapter) Ping(ctx context.Context) error {
	if a.httpClient == nil {
		return fmt.Errorf("not connected to Typesense")
	}

	start := time.Now()
	_, err := a.makeRequest(ctx, "GET", "/health", nil)

	if a.base != nil {
		a.base.RecordHealthCheck(err == nil, time.Since(start), err)
	}

	return err
}

// TestConnection tests the connection
func (a *TypesenseAdapter) TestConnection(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetrics returns connection metrics
func (a *TypesenseAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	dbInfo := types.DatabaseInfo{
		Engine:  "Typesense",
		Version: "Unknown",
	}

	if a.base != nil {
		a.base.UpdateMetrics(types.ConnectionPoolStats{}, dbInfo)
		return a.base.GetMetrics(), nil
	}

	return &types.ConnectionMetrics{
		LastUpdated:  time.Now(),
		DatabaseInfo: dbInfo,
	}, nil
}

// GetMetadata retrieves metadata about the Typesense connection
func (a *TypesenseAdapter) GetMetadata() map[string]interface{} {
	return map[string]interface{}{
		"engine":                "typesense",
		"search_engine":         true,
		"typo_tolerance":        true,
		"fast_search":           true,
		"facet_search":          true,
		"endpoint":              a.endpoint,
		"supports_transactions": false,
	}
}

// Helper methods

func (a *TypesenseAdapter) makeRequest(ctx context.Context, method, path string, body []byte) ([]byte, error) {
	url := a.endpoint + path

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add API key authentication
	if a.apiKey != "" {
		req.Header.Set("X-TYPESENSE-API-KEY", a.apiKey)
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

func (a *TypesenseAdapter) parseQuery(query string, params ...interface{}) (method, path string, body []byte, err error) {
	query = strings.TrimSpace(query)

	// Handle different query types
	switch {
	case strings.HasPrefix(query, "SEARCH"):
		// Format: SEARCH /collections/collection/documents/search {"q": "query", "query_by": "field"}
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
			if len(params) > 0 {
				body = []byte(fmt.Sprintf("%v", params[0]))
			}
		}
		method = "POST"

	case strings.HasPrefix(query, "GET"):
		// Format: GET /collections or GET /collections/collection
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
		}
		method = "GET"

	case strings.HasPrefix(query, "POST"):
		// Format: POST /collections/collection/documents {"field": "value"}
		parts := strings.Fields(query)
		if len(parts) >= 2 {
			path = parts[1]
			if len(params) > 0 {
				body, _ = json.Marshal(params[0])
			}
		}
		method = "POST"

	default:
		// Default to search query
		method = "POST"
		path = "/collections/documents/search"
		if len(params) > 0 {
			body, _ = json.Marshal(params[0])
		}
	}

	return method, path, body, nil
}

func (a *TypesenseAdapter) formatResponse(resp []byte, method string) ([]map[string]interface{}, []types.ColumnInfo) {
	var response map[string]interface{}
	if err := json.Unmarshal(resp, &response); err != nil {
		return nil, nil
	}

	var rows []map[string]interface{}
	var columns []types.ColumnInfo

	// Handle search response
	if hits, ok := response["hits"].([]interface{}); ok {
		if len(hits) > 0 {
			// Build columns from first hit
			if firstHit, ok := hits[0].(map[string]interface{}); ok {
				if document, ok := firstHit["document"].(map[string]interface{}); ok {
					for field := range document {
						columns = append(columns, types.ColumnInfo{
							Name: field,
							Type: "string", // Default type
						})
					}
					// Add system fields
					columns = append(columns, []types.ColumnInfo{
						{Name: "id", Type: "string"},
						{Name: "highlight", Type: "object"},
						{Name: "text_match", Type: "object"},
					}...)
				}
			}

			// Process all hits
			for _, hit := range hits {
				if hitMap, ok := hit.(map[string]interface{}); ok {
					row := make(map[string]interface{})

					// Add system fields
					if id, ok := hitMap["id"]; ok {
						row["id"] = id
					}
					if highlight, ok := hitMap["highlight"]; ok {
						row["highlight"] = highlight
					}
					if textMatch, ok := hitMap["text_match"]; ok {
						row["text_match"] = textMatch
					}

					// Add document fields
					if document, ok := hitMap["document"].(map[string]interface{}); ok {
						for field, value := range document {
							row[field] = value
						}
					}

					rows = append(rows, row)
				}
			}
		}
	}

	// Default columns if no hits found
	if len(columns) == 0 {
		columns = []types.ColumnInfo{
			{Name: "response", Type: "object"},
		}
		rows = []map[string]interface{}{response}
	}

	return rows, columns
}

func (a *TypesenseAdapter) getCollections(ctx context.Context) ([]string, error) {
	resp, err := a.makeRequest(ctx, "GET", "/collections", nil)
	if err != nil {
		return nil, err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(resp, &response); err != nil {
		return nil, err
	}

	var collections []string
	if collectionsList, ok := response["collections"].([]interface{}); ok {
		for _, collection := range collectionsList {
			if collectionMap, ok := collection.(map[string]interface{}); ok {
				if name, ok := collectionMap["name"].(string); ok {
					collections = append(collections, name)
				}
			}
		}
	}

	return collections, nil
}

func (a *TypesenseAdapter) getCollectionSchema(ctx context.Context, collectionName string) ([]types.ColumnInfo, error) {
	resp, err := a.makeRequest(ctx, "GET", fmt.Sprintf("/collections/%s", collectionName), nil)
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

				column := types.ColumnInfo{
					Name: name,
					Type: a.mapTypesenseType(fieldType),
				}
				columns = append(columns, column)
			}
		}
	}

	return columns, nil
}

func (a *TypesenseAdapter) mapTypesenseType(typesenseType string) string {
	switch typesenseType {
	case "string":
		return "string"
	case "int32":
		return "integer"
	case "int64":
		return "bigint"
	case "float":
		return "double"
	case "bool":
		return "boolean"
	case "geopoint":
		return "geospatial"
	case "string[]":
		return "array"
	case "object":
		return "object"
	case "auto":
		return "string" // Default for auto fields
	default:
		return typesenseType
	}
}
