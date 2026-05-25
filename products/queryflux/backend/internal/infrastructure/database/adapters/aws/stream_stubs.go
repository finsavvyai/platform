package aws

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Phase 1 stubs: Stream is not implemented for AWS-specific adapters; the
// canonical types.DatabaseAdapter interface requires it.
// IntrospectSchema delegates to GetSchema per QUERY_CONTRACT.md §2.

func (a *DynamoDBAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("dynamodb stream not implemented in phase 1")
}
func (a *DynamoDBAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *RDSAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("rds stream not implemented in phase 1")
}
func (a *RDSAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *RedshiftAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("redshift stream not implemented in phase 1")
}
func (a *RedshiftAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *AuroraAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("aurora stream not implemented in phase 1")
}
func (a *AuroraAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *DocumentDBAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("documentdb stream not implemented in phase 1")
}
func (a *DocumentDBAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *ElastiCacheAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("elasticache stream not implemented in phase 1")
}
func (a *ElastiCacheAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *NeptuneAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("neptune stream not implemented in phase 1")
}
func (a *NeptuneAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *KeyspacesAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("keyspaces stream not implemented in phase 1")
}
func (a *KeyspacesAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *TimestreamAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("timestream stream not implemented in phase 1")
}
func (a *TimestreamAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *AthenaAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("athena stream not implemented in phase 1")
}
func (a *AthenaAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *OpenSearchAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("opensearch stream not implemented in phase 1")
}
func (a *OpenSearchAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

// Compile-time guards against canonical Phase 1 types.DatabaseAdapter.
var (
	_ types.DatabaseAdapter = (*DynamoDBAdapter)(nil)
	_ types.DatabaseAdapter = (*RDSAdapter)(nil)
	_ types.DatabaseAdapter = (*RedshiftAdapter)(nil)
	_ types.DatabaseAdapter = (*AuroraAdapter)(nil)
	_ types.DatabaseAdapter = (*DocumentDBAdapter)(nil)
	_ types.DatabaseAdapter = (*ElastiCacheAdapter)(nil)
	_ types.DatabaseAdapter = (*NeptuneAdapter)(nil)
	_ types.DatabaseAdapter = (*KeyspacesAdapter)(nil)
	_ types.DatabaseAdapter = (*TimestreamAdapter)(nil)
	_ types.DatabaseAdapter = (*AthenaAdapter)(nil)
	_ types.DatabaseAdapter = (*OpenSearchAdapter)(nil)
)
