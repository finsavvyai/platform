package aws

import (
	"context"
	"fmt"
	"sync"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
	adaptertypes "github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/sirupsen/logrus"
)

// DynamoDBAdapter implements DatabaseAdapter for AWS DynamoDB
type DynamoDBAdapter struct {
	conn   *entities.Connection
	client *dynamodb.Client
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to DynamoDB
func (d *DynamoDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	if d.client != nil {
		return nil // Already connected
	}

	// Update connection info
	d.conn = conn

	// Create DynamoDB client with configuration from connection
	client, err := d.createDynamoDBClient(conn)
	if err != nil {
		return &adaptertypes.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to create DynamoDB client",
			Details: err.Error(),
		}
	}

	d.client = client
	d.logger.Infof("Connected to DynamoDB: %s", conn.Name)

	return nil
}

// Disconnect closes the DynamoDB connection
func (d *DynamoDBAdapter) Disconnect(ctx context.Context) error {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	if d.client == nil {
		return nil // Already disconnected
	}

	d.client = nil
	d.logger.Infof("Disconnected from DynamoDB: %s", d.conn.Name)

	return nil
}

// TestConnection tests if the DynamoDB connection is valid
func (d *DynamoDBAdapter) TestConnection(ctx context.Context) error {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	if d.client == nil {
		return &adaptertypes.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to DynamoDB",
		}
	}

	// Test connection by listing tables
	_, err := d.client.ListTables(ctx, &dynamodb.ListTablesInput{
		Limit: aws.Int32(1),
	})
	if err != nil {
		return &adaptertypes.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// IsConnected returns true if the adapter is connected to DynamoDB
func (d *DynamoDBAdapter) IsConnected() bool {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	return d.client != nil
}

// GetConnectionInfo returns the connection information
func (d *DynamoDBAdapter) GetConnectionInfo() *entities.Connection {
	return d.conn
}

// Helper to convert string slice to ColumnInfo slice
func (d *DynamoDBAdapter) toColumnInfo(names []string) []adaptertypes.ColumnInfo {
	columns := make([]adaptertypes.ColumnInfo, len(names))
	for i, name := range names {
		columns[i] = adaptertypes.ColumnInfo{
			Name: name,
			Type: "string", // Default to string
		}
	}
	return columns
}

// HealthCheck checks the health of the connection
func (d *DynamoDBAdapter) HealthCheck(ctx context.Context) error {
	return d.TestConnection(ctx)
}

// Ping pings the database
func (d *DynamoDBAdapter) Ping(ctx context.Context) error {
	return d.TestConnection(ctx)
}

// GetMetrics retrieves connection metrics
func (d *DynamoDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	// DynamoDB doesn't expose pool stats in the same way
	return &types.ConnectionMetrics{}, nil
}

// BeginTransaction starts a new transaction
func (d *DynamoDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions not supported yet for DynamoDB adapter (use TransactWriteItems)")
}
