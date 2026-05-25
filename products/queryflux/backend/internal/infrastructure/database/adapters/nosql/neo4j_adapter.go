package nosql

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/base"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/sirupsen/logrus"
)

// Neo4jAdapter implements DatabaseAdapter for Neo4j
type Neo4jAdapter struct {
	base   *base.EnhancedBaseAdapter
	conn   *entities.Connection
	driver neo4j.DriverWithContext
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to Neo4j
func (n *Neo4jAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	if n.driver != nil {
		return nil // Already connected
	}

	// Update connection info
	n.conn = conn

	// Initialize base adapter
	if n.logger == nil {
		n.logger = logrus.New()
	}
	n.base = base.NewEnhancedBaseAdapter(conn, n.logger)

	// Build connection URI
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return n.base.CreateError("CONNECTION_STRING_ERROR", "Failed to build connection string", err.Error(), "")
	}

	// Configure authentication
	var auth neo4j.AuthToken
	if conn.Username != "" && conn.Password != "" {
		auth = neo4j.BasicAuth(conn.Username, conn.Password, "")
	} else {
		auth = neo4j.NoAuth()
	}

	// Configure driver options
	config := func(conf *neo4j.Config) {
		conf.UserAgent = "QueryFlux/1.0"

		// Note: Encryption is now configured via URI scheme (bolt+s:// or neo4j+s://)
		// SSL/TLS configuration is handled automatically based on the connection URI

		// Set max connection pool size from options
		if maxPoolSize := conn.Options["max_pool_size"]; maxPoolSize != "" {
			// Parse and set max pool size if needed
		}
	}

	// Create driver
	driver, err := neo4j.NewDriverWithContext(connStr, auth, config)
	if err != nil {
		return n.base.CreateError("DRIVER_CREATION_FAILED", "Failed to create Neo4j driver", err.Error(), "")
	}

	// Verify connectivity
	err = driver.VerifyConnectivity(ctx)
	if err != nil {
		driver.Close(ctx)
		return n.base.CreateError("CONNECTION_TEST_FAILED", "Failed to verify Neo4j connectivity", err.Error(), "")
	}

	n.driver = driver
	n.logger.Infof("Connected to Neo4j: %s", conn.Name)

	return nil
}

// Disconnect closes the Neo4j connection
func (n *Neo4jAdapter) Disconnect(ctx context.Context) error {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	if n.base != nil {
		n.base.Close()
	}

	if n.driver == nil {
		return nil // Already disconnected
	}

	err := n.driver.Close(ctx)
	n.driver = nil

	if err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to close Neo4j driver",
			Details: err.Error(),
		}
	}

	n.logger.Infof("Disconnected from Neo4j: %s", n.conn.Name)
	return nil
}

// IsConnected returns true if the adapter is connected to Neo4j
func (n *Neo4jAdapter) IsConnected() bool {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	return n.driver != nil
}

// TestConnection tests if the Neo4j connection is valid
func (n *Neo4jAdapter) TestConnection(ctx context.Context) error {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	if n.driver == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Neo4j",
		}
	}

	start := time.Now()
	err := n.driver.VerifyConnectivity(ctx)

	if n.base != nil {
		n.base.RecordHealthCheck(err == nil, time.Since(start), err)
	}

	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// Shutdown closes the connection
func (n *Neo4jAdapter) Shutdown(ctx context.Context) error {
	return n.Disconnect(ctx)
}

// GetColumns returns columns
func (n *Neo4jAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := n.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}

// ExecuteQuery executes a Cypher query
func (n *Neo4jAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	if n.driver == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Neo4j",
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

	var start time.Time
	if n.base != nil {
		start = n.base.TrackQueryStart(query)
	} else {
		start = time.Now()
	}

	// Convert params to map if provided
	var paramMap map[string]interface{}
	if len(params) > 0 {
		if paramMapArg, ok := params[0].(map[string]interface{}); ok {
			paramMap = paramMapArg
		} else {
			// Convert positional params to named params
			paramMap = make(map[string]interface{})
			for i, param := range params {
				paramMap[fmt.Sprintf("param%d", i)] = param
			}
		}
	}

	// Get database name from connection or use default
	database := n.conn.Database
	if database == "" {
		database = "neo4j" // Default database
	}

	// Create session
	session := n.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: database,
		AccessMode:   neo4j.AccessModeRead, // Default to read mode
	})
	defer session.Close(ctx)

	// Determine if this is a write query
	upperQuery := strings.ToUpper(query)
	isWriteQuery := strings.Contains(upperQuery, "CREATE") ||
		strings.Contains(upperQuery, "MERGE") ||
		strings.Contains(upperQuery, "SET") ||
		strings.Contains(upperQuery, "DELETE") ||
		strings.Contains(upperQuery, "REMOVE")

	var resultAny any
	var err error

	if isWriteQuery {
		// Execute as write transaction
		resultAny, err = session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			return tx.Run(ctx, query, paramMap)
		})
	} else {
		// Execute as read transaction
		resultAny, err = session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			return tx.Run(ctx, query, paramMap)
		})
	}

	if n.base != nil {
		n.base.TrackQueryEnd(start, err == nil, err)
	}

	if err != nil {
		return nil, n.base.CreateError("QUERY_EXECUTION_FAILED", "Failed to execute Cypher query", err.Error(), query)
	}

	// Assert result type
	result, ok := resultAny.(neo4j.ResultWithContext)
	if !ok {
		return nil, &types.AdapterError{
			Code:    "RESULT_TYPE_ERROR",
			Message: "Failed to cast query result",
		}
	}

	// Convert results
	return n.convertNeo4jResult(ctx, result)
}

// GetSchema retrieves Neo4j schema information (labels, relationships, properties)
func (n *Neo4jAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	if n.driver == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Neo4j",
		}
	}

	var tables []types.TableInfo

	// Get node labels (treated as tables)
	labels, err := n.getNodeLabels(ctx)
	if err != nil {
		return nil, err
	}

	for _, label := range labels {
		tableInfo, err := n.GetTableInfo(ctx, label)
		if err != nil {
			n.logger.Warnf("Failed to get info for label %s: %v", label, err)
			// Continue with basic info
			tableInfo = &types.TableInfo{
				Name:   label,
				Schema: "nodes",
			}
		}
		tables = append(tables, *tableInfo)
	}

	// Get relationship types (also treated as tables)
	relationships, err := n.getRelationshipTypes(ctx)
	if err != nil {
		n.logger.Warnf("Failed to get relationship types: %v", err)
	} else {
		for _, relType := range relationships {
			tables = append(tables, types.TableInfo{
				Name:   relType,
				Schema: "relationships",
			})
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific label or relationship type
func (n *Neo4jAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	if n.driver == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Neo4j",
		}
	}

	// Get properties for this label
	properties, err := n.getLabelProperties(ctx, tableName)
	if err != nil {
		return nil, err
	}

	var columns []types.ColumnInfo
	for _, prop := range properties {
		columns = append(columns, types.ColumnInfo{
			Name:     prop,
			Type:     "mixed", // Neo4j properties can be of various types
			Nullable: true,    // Properties are generally optional in Neo4j
		})
	}

	// Get indexes for this label
	indexes, err := n.getLabelIndexes(ctx, tableName)
	if err != nil {
		n.logger.Warnf("Failed to get indexes for label %s: %v", tableName, err)
		indexes = []types.IndexInfo{}
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  "nodes",
		Columns: columns,
		Indexes: indexes,
	}, nil
}

// GetConnectionInfo returns the connection information
func (n *Neo4jAdapter) GetConnectionInfo() *entities.Connection {
	if n.base != nil {
		return n.base.GetConnection()
	}
	return n.conn
}

// Helper methods

func (n *Neo4jAdapter) getNodeLabels(ctx context.Context) ([]string, error) {
	query := "CALL db.labels()"
	result, err := n.executeQueryInternal(ctx, query)
	if err != nil {
		return nil, err
	}

	var labels []string
	for _, row := range result.Rows {
		if label, exists := row["label"]; exists {
			if labelStr, ok := label.(string); ok {
				labels = append(labels, labelStr)
			}
		}
	}

	return labels, nil
}

func (n *Neo4jAdapter) getRelationshipTypes(ctx context.Context) ([]string, error) {
	query := "CALL db.relationshipTypes()"
	result, err := n.executeQueryInternal(ctx, query)
	if err != nil {
		return nil, err
	}

	var types []string
	for _, row := range result.Rows {
		if relType, exists := row["relationshipType"]; exists {
			if typeStr, ok := relType.(string); ok {
				types = append(types, typeStr)
			}
		}
	}

	return types, nil
}

func (n *Neo4jAdapter) getLabelProperties(ctx context.Context, label string) ([]string, error) {
	query := "CALL db.propertyKeys() YIELD propertyKey RETURN DISTINCT propertyKey"
	result, err := n.executeQueryInternal(ctx, query)
	if err != nil {
		return nil, err
	}

	var properties []string
	for _, row := range result.Rows {
		if prop, exists := row["propertyKey"]; exists {
			if propStr, ok := prop.(string); ok {
				properties = append(properties, propStr)
			}
		}
	}

	return properties, nil
}

// ... (skip intermediate methods) ...
func (n *Neo4jAdapter) executeQueryInternal(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	session := n.driver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	// Convert params to map if possible, regarding the first param as the map
	var parameters map[string]interface{}
	if len(params) > 0 {
		if p, ok := params[0].(map[string]interface{}); ok {
			parameters = p
		}
	}

	result, err := session.Run(ctx, query, parameters)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_FAILED",
			Message: "Neo4j query execution failed",
			Details: err.Error(),
		}
	}

	// Using convertNeo4jResult(ctx, result)
	return n.convertNeo4jResult(ctx, result)
}

// But I can't easily jump around. I will focus on specific blocks.

// Block 1: Fix getLabelProperties
// Block 2: Fix convertNeo4jResult signature and usage.
// ExecuteQuery calls convertNeo4jResult at line 271. I need to update that too.

func (n *Neo4jAdapter) getLabelIndexes(ctx context.Context, label string) ([]types.IndexInfo, error) {
	query := "CALL db.indexes()"
	result, err := n.executeQueryInternal(ctx, query)
	if err != nil {
		return nil, err
	}

	var indexes []types.IndexInfo
	for _, row := range result.Rows {
		// Parse index information from Neo4j result
		if indexName, exists := row["name"]; exists {
			if nameStr, ok := indexName.(string); ok {
				// Extract properties if available
				var properties []string
				if props, exists := row["properties"]; exists {
					if propList, ok := props.([]interface{}); ok {
						for _, prop := range propList {
							if propStr, ok := prop.(string); ok {
								properties = append(properties, propStr)
							}
						}
					}
				}

				// Check if it's unique
				isUnique := false
				if uniqueness, exists := row["uniqueness"]; exists {
					if uniqueStr, ok := uniqueness.(string); ok {
						isUnique = uniqueStr == "UNIQUE"
					}
				}

				indexes = append(indexes, types.IndexInfo{
					Name:    nameStr,
					Columns: properties,
					Unique:  isUnique,
				})
			}
		}
	}

	return indexes, nil
}

func (n *Neo4jAdapter) convertNeo4jResult(ctx context.Context, result neo4j.ResultWithContext) (*types.QueryResult, error) {
	var columns []string
	var rows []map[string]interface{}

	// Get column names from the first record
	var resultColumns []types.ColumnInfo

	if result.Next(ctx) {
		record := result.Record()
		columns = record.Keys

		for _, col := range columns {
			resultColumns = append(resultColumns, types.ColumnInfo{
				Name: col,
				Type: "unknown", // Neo4j doesn't give type metadata easily here
			})
		}

		// Process first record
		row := make(map[string]interface{})
		for i, key := range columns {
			row[key] = record.Values[i]
		}
		rows = append(rows, row)

		// Process remaining records
		for result.Next(ctx) {
			record := result.Record()
			row := make(map[string]interface{})
			for i, key := range columns {
				row[key] = record.Values[i]
			}
			rows = append(rows, row)
		}
	}

	// Check for errors
	if err := result.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "RESULT_PROCESSING_FAILED",
			Message: "Failed to process Neo4j result",
			Details: err.Error(),
		}
	}

	return &types.QueryResult{
		Columns: resultColumns,
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}

// HealthCheck checks the health of the connection
func (n *Neo4jAdapter) HealthCheck(ctx context.Context) error {
	return n.TestConnection(ctx)
}

// Ping pings the database
func (n *Neo4jAdapter) Ping(ctx context.Context) error {
	return n.TestConnection(ctx)
}

// GetMetrics retrieves connection metrics (Neo4j driver provides limited metrics)
func (n *Neo4jAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if n.driver == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected"}
	}

	dbInfo := types.DatabaseInfo{
		Engine:  "Neo4j",
		Version: "5.x",
	}

	// Update base metrics if available
	if n.base != nil {
		n.base.UpdateMetrics(types.ConnectionPoolStats{}, dbInfo)
		return n.base.GetMetrics(), nil
	}

	return &types.ConnectionMetrics{
		DatabaseInfo: dbInfo,
	}, nil
}

type Neo4jTransaction struct {
	tx      neo4j.ExplicitTransaction
	session neo4j.SessionWithContext
}

func (t *Neo4jTransaction) Commit() error {
	err := t.tx.Commit(context.Background())
	if t.session != nil {
		t.session.Close(context.Background())
	}
	return err
}

func (t *Neo4jTransaction) Rollback() error {
	err := t.tx.Rollback(context.Background())
	if t.session != nil {
		t.session.Close(context.Background())
	}
	return err
}

// BeginTransaction starts a new transaction
func (n *Neo4jAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if n.driver == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected"}
	}
	session := n.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	tx, err := session.BeginTransaction(ctx)
	if err != nil {
		session.Close(ctx)
		return nil, err
	}
	return &Neo4jTransaction{tx: tx, session: session}, nil
}
