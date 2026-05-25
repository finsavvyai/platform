package cache

import (
	"context"
	"errors"
	"net"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/redis/go-redis/v9"
)

// Local sentinel errors — mirrors QUERY_CONTRACT.md §3.
// Once task #7 lands the canonical adapters/types/errors.go these become
// aliases:  var errRedisTimeout = types.ErrTimeout, etc.
var (
	errRedisTimeout      = errors.New("queryflux: query timeout")
	errRedisAuthFail     = errors.New("queryflux: authentication failed")
	errRedisSyntax       = errors.New("queryflux: query syntax error")
	errRedisConnection   = errors.New("queryflux: connection error")
	errRedisPermission   = errors.New("queryflux: permission denied")
	errRedisInvalidParam = errors.New("queryflux: invalid parameter")
	errRedisMaxRows      = errors.New("queryflux: max rows exceeded")
	errRedisNotConnected = errors.New("queryflux: not connected")
)

// classifyRedisError maps go-redis / network / context errors to the local
// sentinel taxonomy. Returns nil for nil and for redis.Nil (cache miss is not
// an error in the QueryFlux contract — callers decide).
func classifyRedisError(ctx context.Context, err error) error {
	if err == nil || err == redis.Nil {
		return nil
	}
	if ctx != nil {
		if cerr := ctx.Err(); errors.Is(cerr, context.DeadlineExceeded) {
			return errRedisTimeout
		}
		if errors.Is(ctx.Err(), context.Canceled) {
			return errRedisTimeout
		}
	}
	msg := strings.ToUpper(err.Error())
	switch {
	case strings.Contains(msg, "NOAUTH"),
		strings.Contains(msg, "WRONGPASS"),
		strings.Contains(msg, "INVALID PASSWORD"):
		return errRedisAuthFail
	case strings.Contains(msg, "NOPERM"):
		return errRedisPermission
	case strings.Contains(msg, "CONNECTION REFUSED"),
		strings.Contains(msg, "BROKEN PIPE"),
		strings.Contains(msg, "EOF"),
		strings.Contains(msg, "CLOSED"):
		return errRedisConnection
	case strings.Contains(msg, "WRONGTYPE"),
		strings.Contains(msg, "ERR SYNTAX"),
		strings.Contains(msg, "ERR WRONG NUMBER OF ARGUMENTS"):
		return errRedisSyntax
	case strings.Contains(msg, "TIMEOUT"):
		return errRedisTimeout
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return errRedisTimeout
		}
		return errRedisConnection
	}
	return err
}

// redisAdapterError builds an *AdapterError with sentinel context, matching the
// pattern in sql/postgresql_errors.go.
func redisAdapterError(code, message string, ctx context.Context, driverErr error) *types.AdapterError {
	sentinel := classifyRedisError(ctx, driverErr)
	details := ""
	if driverErr != nil {
		details = driverErr.Error()
	}
	ae := &types.AdapterError{
		Code:    code,
		Message: message,
		Details: details,
	}
	if sentinel != nil {
		ae.WithContext("sentinel", sentinel.Error())
	}
	return ae
}

// redisAllowedCommands enumerates commands the Stream cursor + ExecuteQuery
// path will accept. Anything not in this set is rejected — this blocks
// EVAL / EVALSHA / SCRIPT LOAD (Lua injection vector) per task brief item #6.
var redisAllowedCommands = map[string]struct{}{
	"GET": {}, "SET": {}, "DEL": {}, "EXISTS": {},
	"KEYS": {}, "SCAN": {}, "TYPE": {}, "TTL": {},
	"HGET": {}, "HSET": {}, "HGETALL": {}, "HDEL": {}, "HKEYS": {}, "HVALS": {},
	"LRANGE": {}, "LPUSH": {}, "RPUSH": {}, "LLEN": {}, "LPOP": {}, "RPOP": {},
	"SMEMBERS": {}, "SADD": {}, "SREM": {}, "SCARD": {},
	"ZRANGE": {}, "ZADD": {}, "ZREM": {}, "ZCARD": {}, "ZSCORE": {},
	"INFO": {}, "PING": {}, "FLUSHDB": {}, "DBSIZE": {}, "ECHO": {}, "SELECT": {},
	"INCR": {}, "DECR": {}, "INCRBY": {}, "DECRBY": {}, "EXPIRE": {}, "PERSIST": {},
}

// isCommandAllowed validates a parsed command name against the allowlist.
// Lua scripting (EVAL / EVALSHA / SCRIPT) is explicitly blocked.
func isCommandAllowed(name string) bool {
	n := strings.ToUpper(strings.TrimSpace(name))
	if n == "EVAL" || n == "EVALSHA" || n == "SCRIPT" || n == "FUNCTION" {
		return false
	}
	_, ok := redisAllowedCommands[n]
	return ok
}
