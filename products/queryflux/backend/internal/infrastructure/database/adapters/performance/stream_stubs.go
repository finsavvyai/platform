package performance

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Phase 1 stub: Stream is not implemented for performance-class adapters; the
// canonical types.DatabaseAdapter interface requires it.
// IntrospectSchema delegates to GetSchema per QUERY_CONTRACT.md §2.

func (a *SingleStoreAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("singlestore stream not implemented in phase 1")
}
func (a *SingleStoreAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*SingleStoreAdapter)(nil)
