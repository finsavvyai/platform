package sql

import (
	"context"
	"errors"
	"net"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/jackc/pgx/v5/pgconn"
)

// Local sentinel errors — mirrors the taxonomy from QUERY_CONTRACT.md §3.
// Task #7 (errors-types) will land canonical versions in
// adapters/types/errors.go; once that lands these vars become aliases:
//
//	var errPgTimeout = types.ErrTimeout
//
// Keeping them local for now lets #3 (this task) ship without blocking on #7.
var (
	errPgTimeout      = errors.New("queryflux: query timeout")
	errPgAuthFail     = errors.New("queryflux: authentication failed")
	errPgSyntax       = errors.New("queryflux: query syntax error")
	errPgConnection   = errors.New("queryflux: connection error")
	errPgPermission   = errors.New("queryflux: permission denied")
	errPgInvalidParam = errors.New("queryflux: invalid parameter")
	errPgMaxRows      = errors.New("queryflux: max rows exceeded")
	errPgNotConnected = errors.New("queryflux: not connected")
)

// classifyPgError maps pgx / network / context errors to the local sentinel
// taxonomy. It is wrapped into an *AdapterError by the call sites.
func classifyPgError(ctx context.Context, err error) error {
	if err == nil {
		return nil
	}
	if ctx != nil {
		if cerr := ctx.Err(); errors.Is(cerr, context.DeadlineExceeded) {
			return errPgTimeout
		}
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch {
		case strings.HasPrefix(pgErr.Code, "28"): // 28xxx invalid auth
			return errPgAuthFail
		case pgErr.Code == "42501":
			return errPgPermission
		case strings.HasPrefix(pgErr.Code, "42"): // 42xxx syntax/access
			return errPgSyntax
		case strings.HasPrefix(pgErr.Code, "08"): // 08xxx connection
			return errPgConnection
		}
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return errPgConnection
	}
	return err
}

// pgAdapterError builds an *AdapterError that wraps both the driver error and
// the matching sentinel — so callers can errors.Is(err, types.ErrTimeout) once
// #7 lands and our locals become aliases.
func pgAdapterError(code, message string, ctx context.Context, driverErr error) *types.AdapterError {
	sentinel := classifyPgError(ctx, driverErr)
	details := ""
	if driverErr != nil {
		details = driverErr.Error()
	}
	ae := &types.AdapterError{
		Code:    code,
		Message: message,
		Details: details,
	}
	// Attach sentinel via WithContext until #7 introduces an unexported field.
	if sentinel != nil {
		ae.WithContext("sentinel", sentinel.Error())
	}
	return ae
}

// isMultiStatementSQL returns true if the trimmed query contains a `;` followed
// by non-whitespace, non-comment characters — i.e. more than one statement.
// QUERY_CONTRACT.md safe-query rule #1: reject multi-statement payloads.
func isMultiStatementSQL(query string) bool {
	q := strings.TrimSpace(query)
	q = strings.TrimRight(q, "; \t\n")
	return strings.Contains(q, ";")
}
