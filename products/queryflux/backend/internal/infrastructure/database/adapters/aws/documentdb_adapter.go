package aws

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// DocumentDBAdapter implements DatabaseAdapter for AWS DocumentDB
// DocumentDB is MongoDB-compatible and uses the MongoDB wire protocol
type DocumentDBAdapter struct {
	conn   *entities.Connection
	client *mongo.Client
	db     *mongo.Database
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to AWS DocumentDB
func (d *DocumentDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	if d.client != nil {
		return nil // Already connected
	}

	// Update connection info
	d.conn = conn

	// Build DocumentDB connection string
	connStr, err := d.buildDocumentDBConnectionString(conn)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_STRING_ERROR",
			Message: "Failed to build DocumentDB connection string",
			Details: err.Error(),
		}
	}

	// Create client options with DocumentDB-specific settings
	clientOpts := options.Client().ApplyURI(connStr)

	// DocumentDB requires TLS/SSL
	if conn.SSL {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: false, // DocumentDB requires proper TLS
		}
		clientOpts.SetTLSConfig(tlsConfig)
	}

	// Set connection pool options
	clientOpts.SetMaxPoolSize(10)
	clientOpts.SetMinPoolSize(2)
	clientOpts.SetMaxConnIdleTime(30 * time.Minute)
	clientOpts.SetConnectTimeout(10 * time.Second)
	clientOpts.SetServerSelectionTimeout(10 * time.Second)

	// DocumentDB-specific: Set retryable writes to false (not fully supported)
	clientOpts.SetRetryWrites(false)

	// Create MongoDB client
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to connect to AWS DocumentDB",
			Details: err.Error(),
		}
	}

	// Test the connection
	if err := client.Ping(ctx, nil); err != nil {
		client.Disconnect(ctx)
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping AWS DocumentDB",
			Details: err.Error(),
		}
	}

	d.client = client
	d.db = client.Database(conn.Database)
	d.logger.Infof("Connected to AWS DocumentDB database: %s", conn.Name)

	return nil
}

// Disconnect closes the DocumentDB connection
func (d *DocumentDBAdapter) Disconnect(ctx context.Context) error {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	if d.client == nil {
		return nil // Already disconnected
	}

	if err := d.client.Disconnect(ctx); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to disconnect from AWS DocumentDB",
			Details: err.Error(),
		}
	}

	d.client = nil
	d.db = nil
	d.logger.Infof("Disconnected from AWS DocumentDB database: %s", d.conn.Name)

	return nil
}

// TestConnection tests if the DocumentDB connection is valid
func (d *DocumentDBAdapter) TestConnection(ctx context.Context) error {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	if d.client == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	if err := d.client.Ping(ctx, nil); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// ExecuteQuery executes a DocumentDB query (MongoDB-compatible)
func (d *DocumentDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	if d.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Parse the query to extract collection name and operation
	// Simple format: "collection.find({})" or "collection.aggregate([...])"
	parts := strings.SplitN(strings.TrimSpace(query), ".", 2)
	if len(parts) != 2 {
		return nil, &types.AdapterError{
			Code:    "INVALID_QUERY",
			Message: "Invalid DocumentDB query format. Expected: collection.operation(...)",
		}
	}

	collectionName := parts[0]
	operation := parts[1]

	collection := d.db.Collection(collectionName)

	// Handle find operations
	if strings.HasPrefix(operation, "find") {
		cursor, err := collection.Find(ctx, bson.D{})
		if err != nil {
			return nil, &types.AdapterError{
				Code:    "QUERY_EXECUTION_FAILED",
				Message: "Failed to execute DocumentDB query",
				Details: err.Error(),
			}
		}
		defer cursor.Close(ctx)

		var results []map[string]interface{}
		if err := cursor.All(ctx, &results); err != nil {
			return nil, &types.AdapterError{
				Code:    "RESULT_FETCH_FAILED",
				Message: "Failed to fetch DocumentDB results",
				Details: err.Error(),
			}
		}

		// Extract column names from first document
		var columns []string
		if len(results) > 0 {
			for key := range results[0] {
				columns = append(columns, key)
			}
		}

		return &types.QueryResult{
			Columns: d.toColumnInfo(columns),
			Rows:    results,
			Count:   int64(len(results)),
		}, nil
	}

	return nil, &types.AdapterError{
		Code:    "UNSUPPORTED_OPERATION",
		Message: "Unsupported DocumentDB operation",
	}
}

// GetSchema retrieves DocumentDB database schema information
func (d *DocumentDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	if d.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// List all collections in the database
	collections, err := d.db.ListCollectionNames(ctx, bson.D{})
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to list DocumentDB collections",
			Details: err.Error(),
		}
	}

	var tables []types.TableInfo
	for _, collName := range collections {
		tableInfo, err := d.GetTableInfo(ctx, collName)
		if err != nil {
			d.logger.Warnf("Failed to get collection info for %s: %v", collName, err)
			// Continue with basic info
			tableInfo = &types.TableInfo{
				Name:   collName,
				Schema: d.conn.Database,
			}
		}
		tables = append(tables, *tableInfo)
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific DocumentDB collection
func (d *DocumentDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	if d.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	collection := d.db.Collection(tableName)

	// Get a sample document to infer schema
	var sampleDoc map[string]interface{}
	err := collection.FindOne(ctx, bson.D{}).Decode(&sampleDoc)
	if err != nil && err != mongo.ErrNoDocuments {
		return nil, &types.AdapterError{
			Code:    "TABLE_INFO_FAILED",
			Message: "Failed to get DocumentDB collection info",
			Details: err.Error(),
		}
	}

	var columns []types.ColumnInfo
	for key, value := range sampleDoc {
		columns = append(columns, types.ColumnInfo{
			Name:     key,
			Type:     fmt.Sprintf("%T", value),
			Nullable: true,
		})
	}

	// Get collection stats
	_, err = collection.CountDocuments(ctx, bson.D{})
	if err != nil {
		d.logger.Warnf("Failed to count documents in collection %s: %v", tableName, err)
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  d.conn.Database,
		Columns: columns,
	}, nil
}

// IsConnected returns true if the adapter is connected to DocumentDB
func (d *DocumentDBAdapter) IsConnected() bool {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	return d.client != nil
}

// GetConnectionInfo returns the connection information
func (d *DocumentDBAdapter) GetConnectionInfo() *entities.Connection {
	return d.conn
}

// buildDocumentDBConnectionString builds a DocumentDB connection string
func (d *DocumentDBAdapter) buildDocumentDBConnectionString(conn *entities.Connection) (string, error) {
	// DocumentDB connection string format:
	// mongodb://[username:password@]host[:port][/database][?options]

	var connStr strings.Builder
	connStr.WriteString("mongodb://")

	if conn.Username != "" {
		connStr.WriteString(conn.Username)
		if conn.Password != "" {
			connStr.WriteString(":")
			connStr.WriteString(conn.Password)
		}
		connStr.WriteString("@")
	}

	connStr.WriteString(conn.Host)
	if conn.Port > 0 {
		connStr.WriteString(fmt.Sprintf(":%d", conn.Port))
	}

	if conn.Database != "" {
		connStr.WriteString("/")
		connStr.WriteString(conn.Database)
	}

	// Add DocumentDB-specific options
	options := []string{}
	if conn.SSL {
		options = append(options, "ssl=true")
		options = append(options, "replicaSet=rs0") // DocumentDB default replica set
		options = append(options, "readPreference=secondaryPreferred")
	}

	if len(options) > 0 {
		connStr.WriteString("?")
		connStr.WriteString(strings.Join(options, "&"))
	}

	return connStr.String(), nil
}

// Helper to convert string slice to ColumnInfo slice
func (d *DocumentDBAdapter) toColumnInfo(names []string) []types.ColumnInfo {
	columns := make([]types.ColumnInfo, len(names))
	for i, name := range names {
		columns[i] = types.ColumnInfo{
			Name: name,
			Type: "string", // Default to string as DocumentDB is schema-less
		}
	}
	return columns
}

// HealthCheck checks the health of the connection
func (d *DocumentDBAdapter) HealthCheck(ctx context.Context) error {
	return d.TestConnection(ctx)
}

// Ping pings the database
func (d *DocumentDBAdapter) Ping(ctx context.Context) error {
	return d.TestConnection(ctx)
}

// GetMetrics retrieves connection metrics
func (d *DocumentDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if d.client == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to DocumentDB"}
	}
	// MongoDB driver doesn't expose pool stats easily in current version used
	return &types.ConnectionMetrics{}, nil
}

// BeginTransaction starts a new transaction
func (d *DocumentDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions not supported yet for DocumentDB adapter")
}
