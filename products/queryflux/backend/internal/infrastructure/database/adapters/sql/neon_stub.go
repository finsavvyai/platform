package sql

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Stream is out of Phase 1 scope for Neon.
func (n *NeonAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("neon stream not implemented in phase 1")
}

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (n *NeonAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return n.GetSchema(ctx)
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*NeonAdapter)(nil)
