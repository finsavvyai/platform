package cache

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/redis/go-redis/v9"
)

// executeSMembers executes SMEMBERS command
func (r *RedisAdapter) executeSMembers(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 1 {
		return nil, fmt.Errorf("SMEMBERS command requires a key")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	members, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	for _, member := range members {
		rows = append(rows, map[string]interface{}{
			"member": member,
		})
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"member"}),
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}

// executeSAdd executes SADD command
func (r *RedisAdapter) executeSAdd(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 2 {
		return nil, fmt.Errorf("SADD command requires key and at least one member")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	members := make([]interface{}, len(cmd.Args)-1)
	for i := 1; i < len(cmd.Args); i++ {
		members[i-1] = cmd.Args[i]
	}

	count, err := r.client.SAdd(ctx, key, members...).Result()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"added_count"}),
		Rows: []map[string]interface{}{
			{"added_count": count},
		},
		Count: 1,
	}, nil
}

// executeZRange executes ZRANGE command
func (r *RedisAdapter) executeZRange(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 3 {
		return nil, fmt.Errorf("ZRANGE command requires key, start, and stop")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	start, _ := strconv.ParseInt(fmt.Sprintf("%v", cmd.Args[1]), 10, 64)
	stop, _ := strconv.ParseInt(fmt.Sprintf("%v", cmd.Args[2]), 10, 64)

	values, err := r.client.ZRange(ctx, key, start, stop).Result()
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	for i, value := range values {
		rows = append(rows, map[string]interface{}{
			"rank":  start + int64(i),
			"value": value,
		})
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"rank", "value"}),
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}

// executeZAdd executes ZADD command
func (r *RedisAdapter) executeZAdd(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	if len(cmd.Args) < 3 || len(cmd.Args)%2 == 0 {
		return nil, fmt.Errorf("ZADD command requires key and score-member pairs")
	}

	key := fmt.Sprintf("%v", cmd.Args[0])
	members := make([]redis.Z, 0)

	for i := 1; i < len(cmd.Args); i += 2 {
		score, err := strconv.ParseFloat(fmt.Sprintf("%v", cmd.Args[i]), 64)
		if err != nil {
			return nil, fmt.Errorf("invalid score: %v", cmd.Args[i])
		}
		member := fmt.Sprintf("%v", cmd.Args[i+1])
		members = append(members, redis.Z{Score: score, Member: member})
	}

	count, err := r.client.ZAdd(ctx, key, members...).Result()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"added_count"}),
		Rows: []map[string]interface{}{
			{"added_count": count},
		},
		Count: 1,
	}, nil
}

// executeInfo executes INFO command
func (r *RedisAdapter) executeInfo(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	section := ""
	if len(cmd.Args) > 0 {
		section = fmt.Sprintf("%v", cmd.Args[0])
	}

	info, err := r.client.Info(ctx, section).Result()
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	lines := strings.Split(info, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) == 2 {
			rows = append(rows, map[string]interface{}{
				"property": parts[0],
				"value":    parts[1],
			})
		}
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"property", "value"}),
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}
