package types

import (
	"fmt"
	"regexp"
)

// validIdentifier matches a conservative SQL identifier:
//   - first char: ASCII letter or underscore
//   - remaining (up to 62) chars: letter / digit / underscore
//
// 63-char total cap covers the strictest mainstream limit (Postgres NAMEDATALEN-1).
// No dots, no quotes, no spaces, no semicolons, no backticks — anything that
// could escape a `PRAGMA(%s)` / `SHOW VARIABLES LIKE '%s'` / `CREATE TABLE %s`
// interpolation is rejected up front.
var validIdentifier = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]{0,62}$`)

// SafeIdentifier validates a SQL identifier (table, column, index, or pragma
// argument). Returns the identifier unchanged on success, or an error wrapping
// ErrInvalidParam on rejection.
//
// Callers MUST invoke this before any string interpolation into a SQL
// statement that cannot use bound parameters (PRAGMA, SHOW, CREATE, DROP,
// ALTER, GRANT, REVOKE). Statements that accept positional params should
// continue to use them directly — this helper is the escape hatch, not the
// default path.
func SafeIdentifier(s string) (string, error) {
	if !validIdentifier.MatchString(s) {
		return "", fmt.Errorf("%w: invalid identifier %q", ErrInvalidParam, s)
	}
	return s, nil
}
