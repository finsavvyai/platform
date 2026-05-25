package cache

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// GetMetrics returns connection metrics
func (r *RedisAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Redis server",
		}
	}

	metrics := &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "Redis",
			Version: "Unknown",
		},
	}

	poolStats := r.client.PoolStats()
	metrics.ConnectionPoolStats = types.ConnectionPoolStats{
		OpenConnections:  int(poolStats.TotalConns),
		IdleConnections:  int(poolStats.IdleConns),
		InUseConnections: int(poolStats.TotalConns - poolStats.IdleConns),
		WaitCount:        int64(poolStats.Misses),
	}

	return metrics, nil
}

// ExecuteQuery executes a Redis command and returns results
func (r *RedisAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Redis server",
		}
	}

	query = strings.TrimSpace(query)
	if query == "" {
		return nil, &types.AdapterError{
			Code:    "EMPTY_QUERY",
			Message: "Query cannot be empty",
		}
	}

	command, err := r.parseRedisCommand(query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COMMAND_PARSE_FAILED",
			Message: "Failed to parse Redis command",
			Details: err.Error(),
		}
	}

	result, err := r.executeRedisCommand(ctx, command)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COMMAND_EXECUTION_FAILED",
			Message: "Failed to execute Redis command",
			Details: err.Error(),
		}
	}

	return result, nil
}

// parseRedisCommand parses a Redis command string
func (r *RedisAdapter) parseRedisCommand(query string, params ...interface{}) (*RedisCommand, error) {
	parts := strings.Fields(query)
	if len(parts) == 0 {
		return nil, fmt.Errorf("empty command")
	}

	command := &RedisCommand{
		Name: strings.ToUpper(parts[0]),
		Args: make([]interface{}, 0),
	}

	for i := 1; i < len(parts); i++ {
		command.Args = append(command.Args, parts[i])
	}

	for _, param := range params {
		command.Args = append(command.Args, param)
	}

	return command, nil
}

// executeRedisCommand dispatches a Redis command to the appropriate executor
func (r *RedisAdapter) executeRedisCommand(ctx context.Context, cmd *RedisCommand) (*types.QueryResult, error) {
	switch cmd.Name {
	case "GET":
		return r.executeGet(ctx, cmd)
	case "SET":
		return r.executeSet(ctx, cmd)
	case "DEL":
		return r.executeDel(ctx, cmd)
	case "EXISTS":
		return r.executeExists(ctx, cmd)
	case "KEYS":
		return r.executeKeys(ctx, cmd)
	case "SCAN":
		return r.executeScan(ctx, cmd)
	case "HGET":
		return r.executeHGet(ctx, cmd)
	case "HSET":
		return r.executeHSet(ctx, cmd)
	case "HGETALL":
		return r.executeHGetAll(ctx, cmd)
	case "LRANGE":
		return r.executeLRange(ctx, cmd)
	case "LPUSH":
		return r.executeLPush(ctx, cmd)
	case "SMEMBERS":
		return r.executeSMembers(ctx, cmd)
	case "SADD":
		return r.executeSAdd(ctx, cmd)
	case "ZRANGE":
		return r.executeZRange(ctx, cmd)
	case "ZADD":
		return r.executeZAdd(ctx, cmd)
	case "INFO":
		return r.executeInfo(ctx, cmd)
	case "PING":
		return r.executePing(ctx, cmd)
	case "FLUSHDB":
		return r.executeFlushDB(ctx, cmd)
	case "DBSIZE":
		return r.executeDBSize(ctx, cmd)
	default:
		return r.executeGenericCommand(ctx, cmd)
	}
}
