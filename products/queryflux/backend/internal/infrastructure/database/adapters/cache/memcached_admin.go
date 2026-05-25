package cache

import (
	"context"
	"fmt"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// executeStats returns a structured error documenting that gomemcache lacks
// server-side Stats() — this is a known driver limitation, not a runtime
// failure. See memcached_stream.go for the equivalent rationale on enumeration.
func (m *MemcachedAdapter) executeStats() (*types.QueryResult, error) {
	return nil, &types.AdapterError{
		Code:    "STATS_NOT_SUPPORTED",
		Message: "STATS command not supported in current memcache client library",
		Details: "gomemcache does not expose a Stats() API",
	}
}

func (m *MemcachedAdapter) executeFlush() (*types.QueryResult, error) {
	if err := m.client.FlushAll(); err != nil {
		return nil, err
	}
	return &types.QueryResult{
		Columns: m.toColumnInfo([]string{"result"}),
		Rows: []map[string]interface{}{
			{"result": "All items flushed"},
		},
		Count: 1,
	}, nil
}

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (m *MemcachedAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return m.GetSchema(ctx)
}

// GetSchema reports Memcached's virtual schema (stats + items "tables").
func (m *MemcachedAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Memcached",
		}
	}

	tables := []types.TableInfo{
		{
			Name:   "stats",
			Schema: "memcached",
			Columns: []types.ColumnInfo{
				{Name: "stat_name", Type: "string", Nullable: false},
				{Name: "stat_value", Type: "string", Nullable: false},
			},
		},
		{
			Name:   "items",
			Schema: "memcached",
			Columns: []types.ColumnInfo{
				{Name: "key", Type: "string", Nullable: false, IsPrimaryKey: true},
				{Name: "value", Type: "string", Nullable: true},
				{Name: "flags", Type: "integer", Nullable: true},
				{Name: "expiration", Type: "integer", Nullable: true},
			},
		},
	}

	return &types.SchemaInfo{Tables: tables}, nil
}

// GetTableInfo returns metadata for the virtual stats/items tables.
func (m *MemcachedAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	switch tableName {
	case "stats":
		return &types.TableInfo{
			Name:   "stats",
			Schema: "memcached",
			Columns: []types.ColumnInfo{
				{Name: "stat_name", Type: "string", Nullable: false},
				{Name: "stat_value", Type: "string", Nullable: false},
			},
		}, nil
	case "items":
		return &types.TableInfo{
			Name:   "items",
			Schema: "memcached",
			Columns: []types.ColumnInfo{
				{Name: "key", Type: "string", Nullable: false, IsPrimaryKey: true},
				{Name: "value", Type: "string", Nullable: true},
				{Name: "flags", Type: "integer", Nullable: true},
				{Name: "expiration", Type: "integer", Nullable: true},
			},
		}, nil
	default:
		return nil, &types.AdapterError{
			Code:    "TABLE_NOT_FOUND",
			Message: fmt.Sprintf("Table %s not found", tableName),
		}
	}
}
