package query

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// hashQuery returns the sha256 hex digest of sql. Empty sql hashes to
// the empty-string digest so audit rows never contain a stray nil. We
// hash rather than store raw SQL by default because user queries can
// embed PII (emails, names, ids) that should not survive in audit
// tables longer than the row itself.
func hashQuery(sql string) string {
	sum := sha256.Sum256([]byte(sql))
	return hex.EncodeToString(sum[:])
}

// classifyError maps an error to a short, log-safe class string. The
// runner never logs the message verbatim because adapter errors may
// embed raw connection strings. The returned class is one of a small
// closed vocabulary so dashboards can group failures without parsing
// driver-specific text.
func classifyError(err error) string {
	if err == nil {
		return ""
	}
	switch {
	case errors.Is(err, types.ErrTimeout):
		return "timeout"
	case errors.Is(err, types.ErrAuthFail):
		return "auth"
	case errors.Is(err, types.ErrSyntax):
		return "syntax"
	case errors.Is(err, types.ErrPermission):
		return "permission"
	case errors.Is(err, types.ErrConnection):
		return "connection"
	case errors.Is(err, types.ErrInvalidParam):
		return "invalid_param"
	case errors.Is(err, types.ErrMaxRows):
		return "max_rows"
	case errors.Is(err, types.ErrNotConnected):
		return "not_connected"
	default:
		return "unknown"
	}
}

// rowCount returns len(result.Rows) safely. Used by the audit hook
// so a nil result (failed query) reports zero rather than panicking.
func rowCount(r *types.QueryResult) int64 {
	if r == nil {
		return 0
	}
	return int64(len(r.Rows))
}
