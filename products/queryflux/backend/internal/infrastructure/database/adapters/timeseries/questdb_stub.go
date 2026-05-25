package timeseries

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Phase 1 stub methods for QuestDBAdapter — Stream is not implemented and
// IntrospectSchema delegates to GetSchema.

// Stream returns an immediately-closed channel pair with an ErrInvalidParam
// sentinel — QuestDB streaming is out of Phase 1 scope.
func (q *QuestDBAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("questdb stream not implemented in phase 1")
}

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (q *QuestDBAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return q.GetSchema(ctx)
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*QuestDBAdapter)(nil)
