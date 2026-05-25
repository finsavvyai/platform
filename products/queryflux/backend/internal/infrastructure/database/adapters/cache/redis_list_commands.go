package cache

import (
	"context"
	"fmt"
	"strconv"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// executeLRange executes LRANGE command
func (r *RedisAdapter) executeLRange(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 3 {
		return nil, fmt.Errorf("LRANGE command requires key, start, and stop")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	start, _ := strconv.ParseInt(fmt.Sprintf("%v", cmd.Args[1]), 10, 64)
	stop, _ := strconv.ParseInt(fmt.Sprintf("%v", cmd.Args[2]), 10, 64)

	values, err := r.client.LRange(ctx, key, start, stop).Result()
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	for i, value := range values {
		rows = append(rows, map[string]interface{}{
			"index": start + int64(i),
			"value": value,
		})
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"index", "value"}),
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}

// executeLPush executes LPUSH command
func (r *RedisAdapter) executeLPush(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 2 {
		return nil, fmt.Errorf("LPUSH command requires key and at least one value")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	values := make([]interface{}, len(cmd.Args)-1)
	for i := 1; i < len(cmd.Args); i++ {
		values[i-1] = cmd.Args[i]
	}

	count, err := r.client.LPush(ctx, key, values...).Result()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"list_length"}),
		Rows: []map[string]interface{}{
			{"list_length": count},
		},
		Count: 1,
	}, nil
}
