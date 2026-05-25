package sql

import (
	"context"
	"errors"

	"github.com/go-sql-driver/mysql"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// MySQL family (mysql, mariadb, mariadb-enhanced) typed sentinel errors.
//
// Phase 1 NOTE: package types/errors.go (owner: task #7) is the canonical home
// for sentinels (types.ErrTimeout, types.ErrAuthFail, ...). Until #7 lands,
// the MySQL/MariaDB adapters expose package-local sentinels with identical
// semantics so callers can use errors.Is. When #7 ships, swap these aliases
// to point at types.ErrX (one-line change, no caller impact).
var (
	errMySQLTimeout    = errors.New("queryflux: query timeout")
	errMySQLAuthFail   = errors.New("queryflux: authentication failed")
	errMySQLSyntax     = errors.New("queryflux: query syntax error")
	errMySQLConnection = errors.New("queryflux: connection error")
	errMySQLPermission = errors.New("queryflux: permission denied")
	errMySQLNotConn    = errors.New("queryflux: not connected")
	errMySQLMaxRows    = errors.New("queryflux: max rows exceeded")
)

// mapMySQLError converts a driver-level error into an *types.AdapterError whose
// Unwrap target is one of the sentinels above (or a context error when ctx is
// the cause). It is safe to call with err == nil (returns nil).
//
// Mappings (per QUERY_CONTRACT.md §3 and task #4 brief):
//   1045 (ER_ACCESS_DENIED)          -> ErrAuthFail
//   1064 (ER_PARSE_ERROR)            -> ErrSyntax
//   1227 (ER_SPECIFIC_ACCESS_DENIED) -> ErrPermission
//   2002/2003 (CR_*)                 -> ErrConnection
//   context.DeadlineExceeded         -> ErrTimeout
//   context.Canceled                 -> ErrTimeout (best-fit; caller cancelled)
func mapMySQLError(ctx context.Context, op string, err error) error {
	if err == nil {
		return nil
	}

	// Context-driven errors win first — we want timeouts even if driver
	// also returned a connection-style error after ctx cancellation.
	if ctxErr := ctx.Err(); ctxErr != nil {
		if errors.Is(ctxErr, context.DeadlineExceeded) || errors.Is(ctxErr, context.Canceled) {
			return wrapMySQLAdapterErr(op, "QUERY_TIMEOUT", err.Error(), errMySQLTimeout)
		}
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return wrapMySQLAdapterErr(op, "QUERY_TIMEOUT", err.Error(), errMySQLTimeout)
	}

	// Driver-level MySQL error codes.
	var mErr *mysql.MySQLError
	if errors.As(err, &mErr) {
		switch mErr.Number {
		case 1045: // ER_ACCESS_DENIED_ERROR
			return wrapMySQLAdapterErr(op, "AUTH_FAILED", mErr.Message, errMySQLAuthFail)
		case 1064: // ER_PARSE_ERROR
			return wrapMySQLAdapterErr(op, "SYNTAX_ERROR", mErr.Message, errMySQLSyntax)
		case 1227, 1142, 1143: // permission / specific-access / table-grant / column-grant
			return wrapMySQLAdapterErr(op, "PERMISSION_DENIED", mErr.Message, errMySQLPermission)
		}
	}

	// Network/transport errors (driver returns these as plain Go errors).
	// 2002/2003 manifest as mysql.ErrInvalidConn or net.OpError; we treat
	// any unrecognised err during connection-bound ops as ErrConnection
	// only when the op is connect/ping. Otherwise leave as generic.
	if errors.Is(err, mysql.ErrInvalidConn) {
		return wrapMySQLAdapterErr(op, "CONNECTION_LOST", err.Error(), errMySQLConnection)
	}

	// Default: keep original error code surface; no sentinel wrapping so
	// callers see the raw driver text for unmapped failures.
	return &types.AdapterError{
		Code:    "QUERY_EXECUTION_FAILED",
		Message: op,
		Details: err.Error(),
	}
}

// wrapMySQLAdapterErr builds an AdapterError that carries a sentinel via the
// Details field. Once types.AdapterError.Unwrap lands (task #7) the sentinel
// is recoverable via errors.Is. For now we expose the sentinel through the
// Wrapped sibling helper below for direct comparison in adapter unit tests.
func wrapMySQLAdapterErr(op, code, details string, sentinel error) *mysqlAdapterError {
	return &mysqlAdapterError{
		AdapterError: &types.AdapterError{
			Code:    code,
			Message: op,
			Details: details,
		},
		sentinel: sentinel,
	}
}

// mysqlAdapterError wraps types.AdapterError with a sentinel for errors.Is
// support. types.AdapterError gains its own Unwrap in task #7; this wrapper
// is the bridge until then. Returned as `error` so callers see the standard
// surface.
type mysqlAdapterError struct {
	*types.AdapterError
	sentinel error
}

func (e *mysqlAdapterError) Unwrap() error { return e.sentinel }

func (e *mysqlAdapterError) Is(target error) bool {
	return errors.Is(e.sentinel, target)
}
