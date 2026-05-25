package nosql

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Stream is out of Phase 1 scope for ArangoDB.
func (a *ArangoDBAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("arangodb stream not implemented in phase 1")
}

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (a *ArangoDBAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*ArangoDBAdapter)(nil)
