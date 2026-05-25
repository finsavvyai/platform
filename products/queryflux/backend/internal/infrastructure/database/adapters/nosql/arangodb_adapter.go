package nosql

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/arangodb/go-driver"
	"github.com/arangodb/go-driver/http"
	"github.com/sirupsen/logrus"
)

// ArangoDBAdapter implements DatabaseAdapter for ArangoDB
// ArangoDB is a multi-model database supporting documents, graphs, and key-value
type ArangoDBAdapter struct {
	conn   *entities.Connection
	client driver.Client
	db     driver.Database
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to ArangoDB
func (a *ArangoDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	if a.client != nil {
		return nil // Already connected
	}

	// Update connection info
	a.conn = conn

	// Build ArangoDB connection
	scheme := "http"
	if conn.SSL {
		scheme = "https"
	}

	endpoint := fmt.Sprintf("%s://%s:%d", scheme, conn.Host, conn.Port)

	// Create HTTP connection
	httpConn, err := http.NewConnection(http.ConnectionConfig{
		Endpoints: []string{endpoint},
	})
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_CREATION_FAILED",
			Message: "Failed to create ArangoDB connection",
			Details: err.Error(),
		}
	}

	// Create client configuration
	clientConfig := driver.ClientConfig{
		Connection: httpConn,
	}

	// Add authentication if credentials provided
	if conn.Username != "" {
		clientConfig.Authentication = driver.BasicAuthentication(conn.Username, conn.Password)
	}

	// Create client
	client, err := driver.NewClient(clientConfig)
	if err != nil {
		return &types.AdapterError{
			Code:    "CLIENT_CREATION_FAILED",
			Message: "Failed to create ArangoDB client",
			Details: err.Error(),
		}
	}

	// Get or create database
	dbExists, err := client.DatabaseExists(ctx, conn.Database)
	if err != nil {
		return &types.AdapterError{
			Code:    "DATABASE_CHECK_FAILED",
			Message: "Failed to check if database exists",
			Details: err.Error(),
		}
	}

	var db driver.Database
	if dbExists {
		db, err = client.Database(ctx, conn.Database)
		if err != nil {
			return &types.AdapterError{
				Code:    "DATABASE_OPEN_FAILED",
				Message: "Failed to open ArangoDB database",
				Details: err.Error(),
			}
		}
	} else {
		return &types.AdapterError{
			Code:    "DATABASE_NOT_FOUND",
			Message: fmt.Sprintf("Database %s does not exist", conn.Database),
		}
	}

	// Test connection
	version, err := client.Version(ctx)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to get ArangoDB version",
			Details: err.Error(),
		}
	}

	a.client = client
	a.db = db
	a.logger.Infof("Connected to ArangoDB %s database: %s", version.Version, conn.Name)

	return nil
}

// Disconnect closes the ArangoDB connection
func (a *ArangoDBAdapter) Disconnect(ctx context.Context) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	if a.client == nil {
		return nil // Already disconnected
	}

	// ArangoDB driver doesn't require explicit disconnect
	a.client = nil
	a.db = nil
	a.logger.Infof("Disconnected from ArangoDB database: %s", a.conn.Name)

	return nil
}

// TestConnection tests if the ArangoDB connection is valid
func (a *ArangoDBAdapter) TestConnection(ctx context.Context) error {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	if a.client == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Test by getting server version
	_, err := a.client.Version(ctx)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// HealthCheck checks the health of the connection
func (a *ArangoDBAdapter) HealthCheck(ctx context.Context) error {
	return a.TestConnection(ctx)
}

// ExecuteQuery executes an ArangoDB AQL query
func (a *ArangoDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	if a.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Execute AQL query
	cursor, err := a.db.Query(ctx, query, nil)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute ArangoDB query",
			Details: err.Error(),
		}
	}
	defer cursor.Close()

	// Collect results
	var results []map[string]interface{}
	for {
		var doc map[string]interface{}
		_, err := cursor.ReadDocument(ctx, &doc)
		if driver.IsNoMoreDocuments(err) {
			break
		} else if err != nil {
			return nil, &types.AdapterError{
				Code:    "RESULT_READ_FAILED",
				Message: "Failed to read query result",
				Details: err.Error(),
			}
		}
		results = append(results, doc)
	}

	// Extract column names from first document
	var columns []types.ColumnInfo
	if len(results) > 0 {
		for key, value := range results[0] {
			columns = append(columns, types.ColumnInfo{
				Name: key,
				Type: fmt.Sprintf("%T", value),
			})
		}
	}

	return &types.QueryResult{
		Columns: columns,
		Rows:    results,
		Count:   int64(len(results)),
	}, nil
}

// GetSchema retrieves ArangoDB database schema information
func (a *ArangoDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	if a.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Get all collections
	collections, err := a.db.Collections(ctx)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to list ArangoDB collections",
			Details: err.Error(),
		}
	}

	var tables []types.TableInfo
	for _, coll := range collections {
		// Get collection info
		props, err := coll.Properties(ctx)
		if err != nil {
			a.logger.Warnf("Failed to get collection properties for %s: %v", coll.Name(), err)
			tables = append(tables, types.TableInfo{
				Name:   coll.Name(),
				Schema: a.conn.Database,
			})
			continue
		}

		// Get collection type
		collType := "document"
		if props.Type == driver.CollectionTypeEdge {
			collType = "edge"
		}

		tableInfo, err := a.GetTableInfo(ctx, coll.Name())
		if err != nil {
			a.logger.Warnf("Failed to get table info for %s: %v", coll.Name(), err)
			tableInfo = &types.TableInfo{
				Name:   coll.Name(),
				Schema: a.conn.Database,
				Columns: []types.ColumnInfo{
					{Name: "type", Type: collType},
				},
			}
		}

		tables = append(tables, *tableInfo)
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific ArangoDB collection
func (a *ArangoDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	if a.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Get collection
	coll, err := a.db.Collection(ctx, tableName)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COLLECTION_NOT_FOUND",
			Message: fmt.Sprintf("Collection %s not found", tableName),
			Details: err.Error(),
		}
	}

	// Get collection properties
	props, err := coll.Properties(ctx)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_INFO_FAILED",
			Message: "Failed to get ArangoDB collection properties",
			Details: err.Error(),
		}
	}

	// Get collection statistics
	_, err = coll.Count(ctx)
	if err != nil {
		a.logger.Warnf("Failed to count documents in collection %s: %v", tableName, err)
	}

	// Infer schema from a sample document
	var columns []types.ColumnInfo
	query := fmt.Sprintf("FOR doc IN %s LIMIT 1 RETURN doc", tableName)
	cursor, err := a.db.Query(ctx, query, nil)
	if err == nil {
		defer cursor.Close()
		var doc map[string]interface{}
		if _, err := cursor.ReadDocument(ctx, &doc); err == nil {
			for key, value := range doc {
				columns = append(columns, types.ColumnInfo{
					Name:     key,
					Type:     fmt.Sprintf("%T", value),
					Nullable: true,
				})
			}
		}
	}

	// Add collection metadata as columns
	collType := "document"
	if props.Type == driver.CollectionTypeEdge {
		collType = "edge"
	}

	if len(columns) == 0 {
		columns = []types.ColumnInfo{
			{Name: "collection_type", Type: collType},
			{Name: "document_count", Type: "integer"},
		}
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  a.conn.Database,
		Columns: columns,
	}, nil
}

// IsConnected returns true if the adapter is connected to ArangoDB
func (a *ArangoDBAdapter) IsConnected() bool {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	return a.client != nil
}

// Shutdown closes the connection
func (a *ArangoDBAdapter) Shutdown(ctx context.Context) error {
	return a.Disconnect(ctx)
}

// Ping checks the connection
func (a *ArangoDBAdapter) Ping(ctx context.Context) error {
	return a.TestConnection(ctx)
}

// GetMetrics returns connection metrics
func (a *ArangoDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(), // Placeholder
		DatabaseInfo: types.DatabaseInfo{
			Engine: "arangodb",
		},
	}, nil
}

// BeginTransaction starts a new transaction
func (a *ArangoDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions not supported in ArangoDB adapter yet")
}

// GetColumns returns a list of columns for a table
func (a *ArangoDBAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := a.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}

// GetConnectionInfo returns the connection information
func (a *ArangoDBAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}
