package analytics

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Phase 1 stubs: Stream is not implemented for analytics adapters; the
// canonical types.DatabaseAdapter interface requires it.
// IntrospectSchema delegates to GetSchema per QUERY_CONTRACT.md §2.

func (a *ClickHouseAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("clickhouse stream not implemented in phase 1")
}
func (a *ClickHouseAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *DuckDBAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("duckdb stream not implemented in phase 1")
}
func (a *DuckDBAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *DruidAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("druid stream not implemented in phase 1")
}
func (a *DruidAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *FlinkAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("flink stream not implemented in phase 1")
}
func (a *FlinkAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

// Compile-time guards against canonical Phase 1 types.DatabaseAdapter.
var (
	_ types.DatabaseAdapter = (*ClickHouseAdapter)(nil)
	_ types.DatabaseAdapter = (*DuckDBAdapter)(nil)
	_ types.DatabaseAdapter = (*DruidAdapter)(nil)
	_ types.DatabaseAdapter = (*FlinkAdapter)(nil)
)
