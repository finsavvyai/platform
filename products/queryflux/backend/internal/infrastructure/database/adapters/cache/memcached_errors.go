package cache

import (
	"context"
	"errors"
	"net"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/bradfitz/gomemcache/memcache"
)

// Local sentinels — mirror QUERY_CONTRACT.md §3. Once task #7 lands canonical
// types.Err* these become aliases.
var (
	errMcTimeout      = errors.New("queryflux: query timeout")
	errMcAuthFail     = errors.New("queryflux: authentication failed")
	errMcSyntax       = errors.New("queryflux: query syntax error")
	errMcConnection   = errors.New("queryflux: connection error")
	errMcPermission   = errors.New("queryflux: permission denied")
	errMcInvalidParam = errors.New("queryflux: invalid parameter")
	errMcMaxRows      = errors.New("queryflux: max rows exceeded")
	errMcNotConnected = errors.New("queryflux: not connected")
)

// classifyMemcachedError maps gomemcache + net + ctx errors to local sentinels.
// memcache.ErrCacheMiss returns nil (cache miss is not an error in the
// QueryFlux contract — callers see found=false in the result row).
func classifyMemcachedError(ctx context.Context, err error) error {
	if err == nil || err == memcache.ErrCacheMiss {
		return nil
	}
	if ctx != nil {
		if cerr := ctx.Err(); errors.Is(cerr, context.DeadlineExceeded) || errors.Is(cerr, context.Canceled) {
			return errMcTimeout
		}
	}
	msg := strings.ToUpper(err.Error())
	switch {
	case strings.Contains(msg, "AUTH"),
		strings.Contains(msg, "UNAUTHORIZED"):
		return errMcAuthFail
	case strings.Contains(msg, "CONNECTION REFUSED"),
		strings.Contains(msg, "BROKEN PIPE"),
		strings.Contains(msg, "EOF"),
		strings.Contains(msg, "NO SERVERS"),
		strings.Contains(msg, "CLOSED"):
		return errMcConnection
	case strings.Contains(msg, "TIMEOUT"):
		return errMcTimeout
	case strings.Contains(msg, "MALFORMED"),
		strings.Contains(msg, "CLIENT_ERROR"):
		return errMcSyntax
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return errMcTimeout
		}
		return errMcConnection
	}
	return err
}

// memcachedAdapterError builds an *AdapterError with sentinel context attached.
func memcachedAdapterError(code, message string, ctx context.Context, driverErr error) *types.AdapterError {
	sentinel := classifyMemcachedError(ctx, driverErr)
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

// memcachedAllowedOps is the op-type allowlist enforced by ExecuteQuery.
// Anything outside this set is rejected at parse time.
var memcachedAllowedOps = map[string]struct{}{
	"get":    {},
	"set":    {},
	"delete": {},
	"stats":  {},
	"flush":  {},
}

func isMemcachedOpAllowed(op string) bool {
	_, ok := memcachedAllowedOps[strings.ToLower(strings.TrimSpace(op))]
	return ok
}
