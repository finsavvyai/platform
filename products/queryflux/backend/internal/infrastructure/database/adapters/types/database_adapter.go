package types

import (
	"context"

	"github.com/queryflux/backend/internal/domain/entities"
)

// DatabaseAdapter is the canonical contract every concrete database adapter
// MUST implement. See QUERY_CONTRACT.md §2 for the binding interface shape.
//
// Phase 1 amendments (v1.0.0):
//   - Stream is now a first-class method on the interface (was per-adapter).
//   - IntrospectSchema is an alias for GetSchema kept for contract symmetry;
//     adapter impls SHOULD delegate one to the other.
type DatabaseAdapter interface {
	// Lifecycle
	Connect(ctx context.Context, conn *entities.Connection) error
	Disconnect(ctx context.Context) error
	TestConnection(ctx context.Context) error
	IsConnected() bool
	GetConnectionInfo() *entities.Connection

	// Execution
	ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*QueryResult, error)

	// Stream executes sql and emits rows over a buffered channel.
	// Honours ctx cancellation. Caps results per opts.MaxRows.
	// errCh emits exactly one terminal error (nil on success) then closes.
	Stream(ctx context.Context, query string, opts StreamOptions, params ...interface{}) (<-chan StreamRow, <-chan error)

	// Schema
	GetSchema(ctx context.Context) (*SchemaInfo, error)
	// IntrospectSchema is an alias for GetSchema (kept for contract symmetry).
	IntrospectSchema(ctx context.Context) (*SchemaInfo, error)
	GetTableInfo(ctx context.Context, tableName string) (*TableInfo, error)

	// Health & metrics
	HealthCheck(ctx context.Context) error
	GetMetrics(ctx context.Context) (*ConnectionMetrics, error)
	Ping(ctx context.Context) error

	// Transactions (for databases that support them)
	BeginTransaction(ctx context.Context) (Transaction, error)
}
