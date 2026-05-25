package timeseries

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Phase 1 stub methods for TimescaleDBAdapter — Stream is not implemented and
// IntrospectSchema delegates to GetSchema.

// Stream returns an immediately-closed channel pair with an ErrInvalidParam
// sentinel — TimescaleDB streaming is out of Phase 1 scope.
func (t *TimescaleDBAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("timescaledb stream not implemented in phase 1")
}

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (t *TimescaleDBAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return t.GetSchema(ctx)
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*TimescaleDBAdapter)(nil)
