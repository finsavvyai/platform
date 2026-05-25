package sql

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Stream is out of Phase 1 scope for PlanetScale.
func (p *PlanetScaleAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("planetscale stream not implemented in phase 1")
}

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (p *PlanetScaleAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return p.GetSchema(ctx)
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*PlanetScaleAdapter)(nil)
