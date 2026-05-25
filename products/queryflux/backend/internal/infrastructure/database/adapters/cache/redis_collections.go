package cache

import (
	"context"
	"fmt"
	"strconv"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/redis/go-redis/v9"
)

// errRedisNil returns the redis.Nil sentinel error for comparison
func errRedisNil() error {
	return redis.Nil
}

// executeKeys executes KEYS command
func (r *RedisAdapter) executeKeys(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	pattern := "*"
	if len(cmd.Args) > 0 {
		pattern = fmt.Sprintf("%v", cmd.Args[0])
	}

	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	for _, key := range keys {
		rows = append(rows, map[string]interface{}{"key": key})
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"key"}),
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}

// executeScan executes SCAN command
func (r *RedisAdapter) executeScan(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	cursor := uint64(0)
	pattern := "*"
	count := int64(10)

	if len(cmd.Args) > 0 {
		if c, err := strconv.ParseUint(fmt.Sprintf("%v", cmd.Args[0]), 10, 64); err == nil {
			cursor = c
		}
	}
	if len(cmd.Args) > 1 {
		pattern = fmt.Sprintf("%v", cmd.Args[1])
	}
	if len(cmd.Args) > 2 {
		if c, err := strconv.ParseInt(fmt.Sprintf("%v", cmd.Args[2]), 10, 64); err == nil {
			count = c
		}
	}

	keys, nextCursor, err := r.client.Scan(ctx, cursor, pattern, count).Result()
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	rows = append(rows, map[string]interface{}{
		"cursor": nextCursor,
		"keys":   keys,
	})

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"cursor", "keys"}),
		Rows:    rows,
		Count:   1,
	}, nil
}

// executeHGet executes HGET command
func (r *RedisAdapter) executeHGet(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 2 {
		return nil, fmt.Errorf("HGET command requires key and field")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	field := fmt.Sprintf("%v", cmd.Args[1])

	val, err := r.client.HGet(ctx, key, field).Result()
	if err != nil {
		if err == redis.Nil {
			return &types.QueryResult{
				Columns: r.toColumnInfo([]string{"key", "value"}),
				Rows: []map[string]interface{}{
					{"field": field, "value": nil},
				},
				Count: 1,
			}, nil
		}
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"field", "value"}),
		Rows: []map[string]interface{}{
			{"field": field, "value": val},
		},
		Count: 1,
	}, nil
}

// executeHSet executes HSET command
func (r *RedisAdapter) executeHSet(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 3 {
		return nil, fmt.Errorf("HSET command requires key, field, and value")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	field := fmt.Sprintf("%v", cmd.Args[1])
	value := fmt.Sprintf("%v", cmd.Args[2])

	count, err := r.client.HSet(ctx, key, field, value).Result()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"fields_set"}),
		Rows: []map[string]interface{}{
			{"fields_set": count},
		},
		Count: 1,
	}, nil
}

// executeHGetAll executes HGETALL command
func (r *RedisAdapter) executeHGetAll(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 1 {
		return nil, fmt.Errorf("HGETALL command requires a key")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	hash, err := r.client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	for field, value := range hash {
		rows = append(rows, map[string]interface{}{
			"field": field,
			"value": value,
		})
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"field", "value"}),
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}
