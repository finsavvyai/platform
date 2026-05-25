package nosql

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// HealthCheck is an alias for Ping (kept for interface compatibility).
func (m *MongoDBAdapter) HealthCheck(ctx context.Context) error { return m.Ping(ctx) }

// GetMetrics returns a minimal ConnectionMetrics for MongoDB.
// Pool stats are not exposed by the official driver; we report engine info
// + last-updated timestamp and leave the rest zero-valued.
func (m *MongoDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine: "mongodb",
		},
	}, nil
}

// BeginTransaction returns an explicit error: MongoDB sessions require a
// replica-set / sharded cluster. Until session-backed transactions land
// (post Phase 1), callers MUST treat MongoDB as auto-commit.
func (m *MongoDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("mongodb transactions not yet supported: %w", ErrInvalidParam)
}

// GetColumns returns the column set of a collection by sampling its docs.
func (m *MongoDBAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := m.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}
