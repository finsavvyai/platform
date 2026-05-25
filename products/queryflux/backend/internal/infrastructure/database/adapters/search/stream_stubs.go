package search

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Phase 1 stubs: Stream is not implemented for search-engine adapters; the
// canonical types.DatabaseAdapter interface requires it.
// IntrospectSchema delegates to GetSchema per QUERY_CONTRACT.md §2.

func (a *ElasticsearchAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("elasticsearch stream not implemented in phase 1")
}
func (a *ElasticsearchAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *SolrAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("solr stream not implemented in phase 1")
}
func (a *SolrAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

func (a *TypesenseAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("typesense stream not implemented in phase 1")
}
func (a *TypesenseAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return a.GetSchema(ctx)
}

// Compile-time guards against canonical Phase 1 types.DatabaseAdapter.
var (
	_ types.DatabaseAdapter = (*ElasticsearchAdapter)(nil)
	_ types.DatabaseAdapter = (*SolrAdapter)(nil)
	_ types.DatabaseAdapter = (*TypesenseAdapter)(nil)
)
