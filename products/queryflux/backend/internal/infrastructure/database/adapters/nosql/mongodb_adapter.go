package nosql

import (
	"sync"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/mongo"
)

// MongoDBAdapter implements the DatabaseAdapter contract for MongoDB.
//
// File layout (each file ≤200 lines per repo CLAUDE.md):
//   - mongodb_adapter.go  : struct, constructor wiring (this file)
//   - mongodb_connect.go  : Connect, Disconnect, TestConnection, Ping, lifecycle
//   - mongodb_exec.go     : ExecuteQuery + operation parsing + executors
//   - mongodb_stream.go   : Stream(ctx, query, opts, params) cursor iteration
//   - mongodb_schema.go   : GetSchema, GetTableInfo, BSON type inference
//   - mongodb_health.go   : HealthCheck, GetMetrics, BeginTransaction
//   - mongodb_errors.go   : driver-error → sentinel mapping
//
// Constructor lives in constructors.go (shared with other nosql adapters).
type MongoDBAdapter struct {
	conn     *entities.Connection
	client   *mongo.Client
	database *mongo.Database
	mutex    sync.RWMutex
	logger   *logrus.Logger
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*MongoDBAdapter)(nil)
