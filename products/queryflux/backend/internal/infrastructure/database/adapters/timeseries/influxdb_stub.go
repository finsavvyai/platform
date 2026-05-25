package timeseries

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Phase 1 stub methods for InfluxDBAdapter — Stream is not implemented and
// IntrospectSchema delegates to GetSchema for canonical interface conformance.
// Full streaming support is tracked in Phase 2 backlog.

// Stream returns an immediately-closed channel pair with an ErrInvalidParam
// sentinel — InfluxDB streaming is out of Phase 1 scope.
func (i *InfluxDBAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("influxdb stream not implemented in phase 1")
}

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (i *InfluxDBAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return i.GetSchema(ctx)
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*InfluxDBAdapter)(nil)
