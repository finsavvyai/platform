package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// GetMetrics returns minimal connection metrics. gomemcache does not expose
// pool stats so most fields stay zero; the engine label is populated.
func (m *MemcachedAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine: "memcached",
		},
	}, nil
}

// BeginTransaction reports that Memcached has no transaction semantics.
func (m *MemcachedAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions not supported for Memcached adapter")
}

// toColumnInfo converts a name list to ColumnInfo (string-typed by default).
func (m *MemcachedAdapter) toColumnInfo(names []string) []types.ColumnInfo {
	columns := make([]types.ColumnInfo, len(names))
	for i, name := range names {
		columns[i] = types.ColumnInfo{Name: name, Type: "string"}
	}
	return columns
}
