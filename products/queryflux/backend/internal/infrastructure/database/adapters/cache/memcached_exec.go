package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/bradfitz/gomemcache/memcache"
)

// ExecuteQuery parses a Memcached-style command (JSON or simple GET/SET/DEL/
// STATS/FLUSH) and executes it. The command name is validated against
// memcachedAllowedOps — anything else is rejected.
func (m *MemcachedAdapter) ExecuteQuery(
	ctx context.Context,
	query string,
	params ...interface{},
) (*types.QueryResult, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Memcached",
		}
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, &types.AdapterError{
			Code:    "EMPTY_QUERY",
			Message: "Query cannot be empty",
		}
	}

	op, err := m.parseOperation(query)
	if err != nil {
		return nil, memcachedAdapterError("QUERY_PARSE_FAILED",
			"Failed to parse Memcached operation", ctx, err)
	}
	if !isMemcachedOpAllowed(op.Type) {
		return nil, memcachedAdapterError("OPERATION_NOT_ALLOWED",
			fmt.Sprintf("Operation %s rejected: not in allowlist", op.Type),
			ctx, errMcPermission)
	}

	result, err := m.executeOperation(ctx, op)
	if err != nil {
		return nil, memcachedAdapterError("QUERY_EXECUTION_FAILED",
			"Failed to execute Memcached operation", ctx, err)
	}
	return result, nil
}

// parseOperation accepts JSON or simple text form.
func (m *MemcachedAdapter) parseOperation(query string) (*MemcachedOperation, error) {
	var op MemcachedOperation
	if err := json.Unmarshal([]byte(query), &op); err == nil {
		return &op, nil
	}
	parts := strings.Fields(strings.ToUpper(query))
	if len(parts) == 0 {
		return nil, fmt.Errorf("empty command")
	}
	command := parts[0]

	switch command {
	case "GET":
		if len(parts) < 2 {
			return nil, fmt.Errorf("GET command requires a key")
		}
		return &MemcachedOperation{Type: "get", Key: parts[1]}, nil
	case "SET":
		if len(parts) < 3 {
			return nil, fmt.Errorf("SET command requires key and value")
		}
		op := &MemcachedOperation{Type: "set", Key: parts[1], Value: parts[2]}
		if len(parts) > 3 {
			if exp, err := strconv.ParseInt(parts[3], 10, 32); err == nil {
				op.Expiration = int32(exp)
			}
		}
		return op, nil
	case "DELETE", "DEL":
		if len(parts) < 2 {
			return nil, fmt.Errorf("DELETE command requires a key")
		}
		return &MemcachedOperation{Type: "delete", Key: parts[1]}, nil
	case "STATS":
		return &MemcachedOperation{Type: "stats"}, nil
	case "FLUSH", "FLUSH_ALL":
		return &MemcachedOperation{Type: "flush"}, nil
	default:
		return nil, fmt.Errorf("unsupported command: %s", command)
	}
}

// executeOperation dispatches an op to its handler.
func (m *MemcachedAdapter) executeOperation(
	ctx context.Context,
	op *MemcachedOperation,
) (*types.QueryResult, error) {
	switch op.Type {
	case "get":
		return m.executeGet(op.Key)
	case "set":
		return m.executeSet(op.Key, op.Value, op.Expiration)
	case "delete":
		return m.executeDelete(op.Key)
	case "stats":
		return m.executeStats()
	case "flush":
		return m.executeFlush()
	default:
		return nil, fmt.Errorf("unsupported operation type: %s", op.Type)
	}
}

func (m *MemcachedAdapter) executeGet(key string) (*types.QueryResult, error) {
	item, err := m.client.Get(key)
	if err != nil {
		if err == memcache.ErrCacheMiss {
			return &types.QueryResult{
				Columns: m.toColumnInfo([]string{"key", "value", "found"}),
				Rows: []map[string]interface{}{
					{"key": key, "value": nil, "found": false},
				},
				Count: 1,
			}, nil
		}
		return nil, err
	}
	return &types.QueryResult{
		Columns: m.toColumnInfo([]string{"key", "value", "flags", "found"}),
		Rows: []map[string]interface{}{
			{"key": key, "value": string(item.Value), "flags": item.Flags, "found": true},
		},
		Count: 1,
	}, nil
}

func (m *MemcachedAdapter) executeSet(key string, value interface{}, expiration int32) (*types.QueryResult, error) {
	var valueStr string
	switch v := value.(type) {
	case string:
		valueStr = v
	case []byte:
		valueStr = string(v)
	default:
		if jsonBytes, err := json.Marshal(value); err == nil {
			valueStr = string(jsonBytes)
		} else {
			valueStr = fmt.Sprintf("%v", value)
		}
	}
	item := &memcache.Item{Key: key, Value: []byte(valueStr), Expiration: expiration}
	if err := m.client.Set(item); err != nil {
		return nil, err
	}
	return &types.QueryResult{
		Columns: m.toColumnInfo([]string{"result", "key"}),
		Rows: []map[string]interface{}{
			{"result": "OK", "key": key},
		},
		Count: 1,
	}, nil
}

func (m *MemcachedAdapter) executeDelete(key string) (*types.QueryResult, error) {
	err := m.client.Delete(key)
	if err != nil && err != memcache.ErrCacheMiss {
		return nil, err
	}
	deleted := err != memcache.ErrCacheMiss
	return &types.QueryResult{
		Columns: m.toColumnInfo([]string{"result", "key", "deleted"}),
		Rows: []map[string]interface{}{
			{"result": "OK", "key": key, "deleted": deleted},
		},
		Count: 1,
	}, nil
}
