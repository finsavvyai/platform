package sql

import (
	"context"
	"errors"
	"strings"

	"github.com/mattn/go-sqlite3"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// mapSQLiteError translates a mattn/go-sqlite3 error into the Phase 1
// sentinel taxonomy (see QUERY_CONTRACT.md §3).
func mapSQLiteError(err error) error {
	if err == nil {
		return nil
	}
	var sqliteErr sqlite3.Error
	if errors.As(err, &sqliteErr) {
		switch sqliteErr.Code {
		case sqlite3.ErrAuth:
			return types.ErrAuthFail
		case sqlite3.ErrPerm, sqlite3.ErrReadonly:
			return types.ErrPermission
		case sqlite3.ErrBusy, sqlite3.ErrLocked, sqlite3.ErrCantOpen,
			sqlite3.ErrIoErr, sqlite3.ErrProtocol, sqlite3.ErrNotADB:
			return types.ErrConnection
		case sqlite3.ErrError:
			// Generic "SQL error or missing database" — most often a syntax
			// or unknown-identifier issue. Confirm via message inspection.
			if looksLikeSyntax(sqliteErr.Error()) {
				return types.ErrSyntax
			}
			return types.ErrSyntax
		case sqlite3.ErrRange, sqlite3.ErrMismatch, sqlite3.ErrConstraint:
			return types.ErrInvalidParam
		}
	}
	// Fallback heuristics for wrapped/string errors.
	low := strings.ToLower(err.Error())
	switch {
	case strings.Contains(low, "syntax"):
		return types.ErrSyntax
	case strings.Contains(low, "unauthorized") || strings.Contains(low, "authentication"):
		return types.ErrAuthFail
	case strings.Contains(low, "permission") || strings.Contains(low, "readonly"):
		return types.ErrPermission
	case strings.Contains(low, "locked") || strings.Contains(low, "busy") || strings.Contains(low, "connection"):
		return types.ErrConnection
	}
	return types.ErrConnection
}

// mapSQLiteCtxError prefers context-derived sentinels (timeout / cancel) over
// the driver classification so that callers get a stable ErrTimeout for
// deadline expiry.
func mapSQLiteCtxError(ctx context.Context, err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.DeadlineExceeded) || (ctx != nil && errors.Is(ctx.Err(), context.DeadlineExceeded)) {
		return types.ErrTimeout
	}
	if errors.Is(err, context.Canceled) || (ctx != nil && errors.Is(ctx.Err(), context.Canceled)) {
		return types.ErrConnection
	}
	return mapSQLiteError(err)
}

func looksLikeSyntax(msg string) bool {
	low := strings.ToLower(msg)
	return strings.Contains(low, "syntax") ||
		strings.Contains(low, "near \"") ||
		strings.Contains(low, "no such")
}
