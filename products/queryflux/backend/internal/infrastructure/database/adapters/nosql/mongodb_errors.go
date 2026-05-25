package nosql

import (
	"errors"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"go.mongodb.org/mongo-driver/mongo"
)

// Sentinel errors. When Task #7 lands `types/errors.go` these will be replaced
// with `types.ErrTimeout` etc. via package-level var aliases — keep names
// identical so callers using `errors.Is(err, ErrTimeout)` keep compiling.
//
// TODO(task-7): drop these and re-export from `types` once available.
var (
	ErrTimeout      = errors.New("queryflux: query timeout")
	ErrAuthFail     = errors.New("queryflux: authentication failed")
	ErrSyntax       = errors.New("queryflux: query syntax error")
	ErrConnection   = errors.New("queryflux: connection error")
	ErrPermission   = errors.New("queryflux: permission denied")
	ErrInvalidParam = errors.New("queryflux: invalid parameter")
	ErrMaxRows      = errors.New("queryflux: max rows exceeded")
	ErrNotConnected = errors.New("queryflux: not connected")
)

// MongoDB server error codes we map to sentinels.
//
//	18, 8000 → ErrAuthFail
//	13       → ErrPermission
const (
	mongoCodeAuthFailed    = 18
	mongoCodeAtlasAuthFail = 8000
	mongoCodePermission    = 13
)

// classifyMongoErr inspects a mongo-driver error and returns the matching
// sentinel. Returns nil if no mapping applies.
func classifyMongoErr(err error) error {
	if err == nil {
		return nil
	}
	if mongo.IsTimeout(err) {
		return ErrTimeout
	}
	if mongo.IsNetworkError(err) {
		return ErrConnection
	}

	// Command errors carry numeric codes.
	var cmdErr mongo.CommandError
	if errors.As(err, &cmdErr) {
		switch int(cmdErr.Code) {
		case mongoCodeAuthFailed, mongoCodeAtlasAuthFail:
			return ErrAuthFail
		case mongoCodePermission:
			return ErrPermission
		}
		// Command-parse / BadValue family → syntax.
		// Mongo emits codes 2 (BadValue), 9 (FailedToParse) for parse errors.
		switch int(cmdErr.Code) {
		case 2, 9:
			return ErrSyntax
		}
	}

	// Write errors (insert/update) may bubble auth/permission too.
	var writeErr mongo.WriteException
	if errors.As(err, &writeErr) {
		for _, we := range writeErr.WriteErrors {
			switch int(we.Code) {
			case mongoCodeAuthFailed, mongoCodeAtlasAuthFail:
				return ErrAuthFail
			case mongoCodePermission:
				return ErrPermission
			case 2, 9:
				return ErrSyntax
			}
		}
	}

	// Last-resort heuristic on message (driver does not always classify).
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "auth") && strings.Contains(msg, "fail"):
		return ErrAuthFail
	case strings.Contains(msg, "unauthorized"):
		return ErrPermission
	case strings.Contains(msg, "syntax"), strings.Contains(msg, "parse"):
		return ErrSyntax
	}
	return nil
}

// mongoErr builds an *types.AdapterError wrapping the underlying driver error
// and the matching sentinel. Credentials never appear in Details.
func mongoErr(code, message string, cause error) *types.AdapterError {
	details := ""
	if cause != nil {
		details = redactCreds(cause.Error())
	}
	ae := types.NewAdapterError(code, message, details)
	if s := classifyMongoErr(cause); s != nil {
		_ = ae.WithContext("sentinel", s.Error())
	}
	return ae
}

// redactCreds strips obvious password tokens out of error messages. The
// mongo-driver occasionally echoes the URI back on connect failures.
func redactCreds(in string) string {
	// mongodb://user:pass@host  →  mongodb://user:***@host
	idx := strings.Index(in, "://")
	if idx < 0 {
		return in
	}
	at := strings.Index(in[idx:], "@")
	if at < 0 {
		return in
	}
	prefix := in[:idx+3]
	rest := in[idx+3 : idx+at]
	suffix := in[idx+at:]
	if colon := strings.Index(rest, ":"); colon >= 0 {
		rest = rest[:colon] + ":***"
	}
	return prefix + rest + suffix
}
