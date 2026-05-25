package server

import (
	"errors"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// MapAdapterErrorToHTTP returns the canonical HTTP status code for a typed
// adapter error per the Phase 1 contract (SWARM_PLAN §#8 done criteria):
//
//	ErrTimeout      -> 504 Gateway Timeout
//	ErrAuthFail     -> 401 Unauthorized
//	ErrSyntax       -> 400 Bad Request
//	ErrPermission   -> 403 Forbidden
//	ErrConnection   -> 503 Service Unavailable
//	ErrInvalidParam -> 400 Bad Request
//	ErrMaxRows      -> 413 Payload Too Large
//	ErrNotConnected -> 503 Service Unavailable
//
// Any unknown error returns 500 Internal Server Error so that handlers
// never leak the raw driver message in the status line.
func MapAdapterErrorToHTTP(err error) int {
	if err == nil {
		return 200
	}
	switch {
	case errors.Is(err, types.ErrTimeout):
		return 504
	case errors.Is(err, types.ErrAuthFail):
		return 401
	case errors.Is(err, types.ErrSyntax):
		return 400
	case errors.Is(err, types.ErrPermission):
		return 403
	case errors.Is(err, types.ErrConnection):
		return 503
	case errors.Is(err, types.ErrInvalidParam):
		return 400
	case errors.Is(err, types.ErrMaxRows):
		return 413
	case errors.Is(err, types.ErrNotConnected):
		return 503
	default:
		return 500
	}
}

// SafeErrorMessage returns a sanitised message safe to embed in an HTTP
// response body.
//
// For known sentinel errors it returns the sentinel's stable, contract-
// defined message (e.g. "queryflux: query timeout"). For unknown errors it
// returns a generic "internal error" string so that raw driver text,
// connection strings, stack traces, or third-party SDK detail never leak
// to the wire.
//
// The mapping mirrors MapAdapterErrorToHTTP so the message and status
// always agree.
func SafeErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	switch {
	case errors.Is(err, types.ErrTimeout):
		return types.ErrTimeout.Error()
	case errors.Is(err, types.ErrAuthFail):
		return types.ErrAuthFail.Error()
	case errors.Is(err, types.ErrSyntax):
		return types.ErrSyntax.Error()
	case errors.Is(err, types.ErrPermission):
		return types.ErrPermission.Error()
	case errors.Is(err, types.ErrConnection):
		return types.ErrConnection.Error()
	case errors.Is(err, types.ErrInvalidParam):
		return types.ErrInvalidParam.Error()
	case errors.Is(err, types.ErrMaxRows):
		return types.ErrMaxRows.Error()
	case errors.Is(err, types.ErrNotConnected):
		return types.ErrNotConnected.Error()
	default:
		return "internal error"
	}
}
