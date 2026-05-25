package cache

import (
	"context"
	"fmt"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// executeGet executes a GET command
func (r *RedisAdapter) executeGet(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 1 {
		return nil, fmt.Errorf("GET requires key")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	val, err := r.client.Get(ctx, key).Result()
	if err == errRedisNil() {
		return &types.QueryResult{
			Columns: r.toColumnInfo([]string{"key", "value"}),
			Rows:    []map[string]interface{}{},
			Count:   0,
		}, nil
	} else if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"key", "value"}),
		Rows: []map[string]interface{}{
			{"key": key, "value": val},
		},
		Count: 1,
	}, nil
}

// executeSet executes SET command
func (r *RedisAdapter) executeSet(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 2 {
		return nil, fmt.Errorf("SET command requires key and value")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	value := fmt.Sprintf("%v", cmd.Args[1])

	err := r.client.Set(ctx, key, value, 0).Err()
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

// executeDel executes DEL command
func (r *RedisAdapter) executeDel(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 1 {
		return nil, fmt.Errorf("DEL command requires at least one key")
	}

	keys := make([]string, len(cmd.Args))
	for i, arg := range cmd.Args {
		keys[i] = fmt.Sprintf("%v", arg)
	}

	count, err := r.client.Del(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"deleted_count"}),
		Rows: []map[string]interface{}{
			{"deleted_count": count},
		},
		Count: 1,
	}, nil
}

// executeExists executes EXISTS command
func (r *RedisAdapter) executeExists(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 1 {
		return nil, fmt.Errorf("EXISTS command requires at least one key")
	}

	keys := make([]string, len(cmd.Args))
	for i, arg := range cmd.Args {
		keys[i] = fmt.Sprintf("%v", arg)
	}

	count, err := r.client.Exists(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"exists_count"}),
		Rows: []map[string]interface{}{
			{"exists_count": count},
		},
		Count: 1,
	}, nil
}
