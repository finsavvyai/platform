package cloud

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Phase 1 stubs: Stream is not implemented for cloud-warehouse adapters; the
// canonical types.DatabaseAdapter interface requires it.
// IntrospectSchema delegates to GetSchema per QUERY_CONTRACT.md §2.

func (a *SnowflakeAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("snowflake stream not implemented in phase 1")
}
func (a *SnowflakeAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *BigQueryAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("bigquery stream not implemented in phase 1")
}
func (a *BigQueryAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *FireboltAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("firebolt stream not implemented in phase 1")
}
func (a *FireboltAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

// Compile-time guards against canonical Phase 1 types.DatabaseAdapter.
var (
	_ types.DatabaseAdapter = (*SnowflakeAdapter)(nil)
	_ types.DatabaseAdapter = (*BigQueryAdapter)(nil)
	_ types.DatabaseAdapter = (*FireboltAdapter)(nil)
)
