package cache

import (
	"context"
	"fmt"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// executePing executes PING command
func (r *RedisAdapter) executePing(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	result, err := r.client.Ping(ctx).Result()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"result"}),
		Rows: []map[string]interface{}{
			{"result": result},
		},
		Count: 1,
	}, nil
}

// executeGenericCommand executes other Redis commands
func (r *RedisAdapter) executeGenericCommand(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	args := make([]interface{}, len(cmd.Args)+1)
	args[0] = cmd.Name
	copy(args[1:], cmd.Args)

	result := r.client.Do(ctx, args...)
	if result.Err() != nil {
		return nil, result.Err()
	}

	val, err := result.Result()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"result"}),
		Rows: []map[string]interface{}{
			{"result": r.convertRedisValue(val)},
		},
		Count: 1,
	}, nil
}

// executeFlushDB executes FLUSHDB command
func (r *RedisAdapter) executeFlushDB(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	err := r.client.FlushDB(ctx).Err()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"result"}),
		Rows: []map[string]interface{}{
			{"result": "OK"},
		},
		Count: 1,
	}, nil
}

// executeDBSize executes DBSIZE command
func (r *RedisAdapter) executeDBSize(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	size, err := r.client.DBSize(ctx).Result()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"score"}),
		Rows: []map[string]interface{}{
			{"db_size": size},
		},
		Count: 1,
	}, nil
}

// convertRedisValue converts Redis values to JSON-compatible types
func (r *RedisAdapter) convertRedisValue(value interface{}) interface{} {
	switch v := value.(type) {
	case []interface{}:
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = r.convertRedisValue(item)
		}
		return result
	case []string:
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = item
		}
		return result
	case map[string]string:
		result := make(map[string]interface{})
		for k, val := range v {
			result[k] = val
		}
		return result
	default:
		return value
	}
}

// IntrospectSchema is the canonical Phase 1 alias for GetSchema.
func (r *RedisAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return r.GetSchema(ctx)
}

// GetSchema retrieves Redis database schema information
func (r *RedisAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Redis server",
		}
	}

	keys, err := r.client.Keys(ctx, "*").Result()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to get Redis keys",
			Details: err.Error(),
		}
	}

	keyTypes := make(map[string]string)
	for _, key := range keys {
		keyType, err := r.client.Type(ctx, key).Result()
		if err != nil {
			r.logger.Warnf("Failed to get type for key %s: %v", key, err)
			keyType = "unknown"
		}
		keyTypes[key] = keyType
	}

	var columns []types.ColumnInfo
	columns = append(columns, types.ColumnInfo{
		Name: "key",
		Type: "string",
	})
	columns = append(columns, types.ColumnInfo{
		Name: "type",
		Type: "string",
	})

	table := types.TableInfo{
		Name:    "redis_keys",
		Schema:  fmt.Sprintf("db%s", r.conn.Database),
		Columns: columns,
	}

	return &types.SchemaInfo{
		Tables: []types.TableInfo{table},
	}, nil
}

// GetTableInfo retrieves information about Redis key patterns
func (r *RedisAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Redis server",
		}
	}

	var columns []types.ColumnInfo
	columns = append(columns, types.ColumnInfo{
		Name: "key",
		Type: "string",
	})
	columns = append(columns, types.ColumnInfo{
		Name: "type",
		Type: "string",
	})
	columns = append(columns, types.ColumnInfo{
		Name: "ttl",
		Type: "integer",
	})

	return &types.TableInfo{
		Name:    tableName,
		Schema:  fmt.Sprintf("db%s", r.conn.Database),
		Columns: columns,
	}, nil
}
