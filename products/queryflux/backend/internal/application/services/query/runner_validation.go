package query

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Validate enforces the safe-query rules from QUERY_CONTRACT §4.
// It runs before any driver call so invalid input never reaches the
// network. All returned errors wrap the typed sentinels declared in
// types/errors.go so callers can branch with errors.Is.
func Validate(sql string, params []interface{}, opts QueryOptions) error {
	trimmed := strings.TrimSpace(sql)
	if trimmed == "" {
		return fmt.Errorf("%w: empty sql", types.ErrInvalidParam)
	}
	if err := rejectMultiStatement(trimmed); err != nil {
		return err
	}
	if err := matchParamCount(trimmed, params); err != nil {
		return err
	}
	if opts.ReadOnly {
		if err := enforceReadOnly(trimmed); err != nil {
			return err
		}
	}
	return nil
}

// rejectMultiStatement scans the SQL for unquoted, non-trailing
// semicolons. A single trailing `;` is permitted because many ORMs
// emit it; anything beyond is treated as a stacked statement and
// rejected as a syntax error.
func rejectMultiStatement(sql string) error {
	clean := stripTrailingSemicolon(sql)
	count := countUnquotedSemicolons(clean)
	if count > 0 {
		return fmt.Errorf("%w: multiple statements not permitted", types.ErrSyntax)
	}
	return nil
}

// matchParamCount counts the positional placeholders in sql and
// requires it to equal len(params). Both Postgres-style ($1, $2) and
// generic-style (?) placeholders are recognised; named placeholders
// are out of scope for Phase 1.
func matchParamCount(sql string, params []interface{}) error {
	q := countPlaceholders(sql)
	if q != len(params) {
		return fmt.Errorf(
			"%w: %d placeholder(s) but %d param(s)",
			types.ErrInvalidParam, q, len(params),
		)
	}
	return nil
}

// enforceReadOnly inspects the first SQL keyword and rejects any
// statement that mutates state. Comments and leading whitespace are
// stripped first so `/* hi */ DELETE ...` still trips the gate.
func enforceReadOnly(sql string) error {
	first := firstKeyword(sql)
	switch first {
	case "INSERT", "UPDATE", "DELETE", "DROP",
		"ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE", "MERGE":
		return fmt.Errorf(
			"%w: read-only mode rejects %s",
			types.ErrPermission, first,
		)
	}
	return nil
}

// firstKeyword returns the upper-cased first identifier in sql after
// stripping leading whitespace and line/block comments.
func firstKeyword(sql string) string {
	s := strings.TrimLeftFunc(sql, unicode.IsSpace)
	for strings.HasPrefix(s, "--") || strings.HasPrefix(s, "/*") {
		if strings.HasPrefix(s, "--") {
			if i := strings.Index(s, "\n"); i >= 0 {
				s = strings.TrimLeftFunc(s[i+1:], unicode.IsSpace)
				continue
			}
			return ""
		}
		if i := strings.Index(s, "*/"); i >= 0 {
			s = strings.TrimLeftFunc(s[i+2:], unicode.IsSpace)
			continue
		}
		return ""
	}
	end := len(s)
	for i, r := range s {
		if !unicode.IsLetter(r) {
			end = i
			break
		}
	}
	return strings.ToUpper(s[:end])
}
