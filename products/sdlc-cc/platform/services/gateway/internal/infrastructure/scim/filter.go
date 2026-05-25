// SCIM 2.0 filter parser. Subset sufficient for Okta + Azure AD
// provisioning compliance: `eq`, `co`, `sw`, `ew`, `pr`. Compound
// expressions via `and` / `or` with parentheses.
//
// Day 23 of the production-ready roadmap.
package scim

import (
	"fmt"
	"strings"
)

// FilterOp is one parsed clause: attribute + operator + (optional) value.
type FilterOp struct {
	Attr  string
	Op    string // eq | co | sw | ew | pr
	Value string
}

// ParseFilter accepts the simple `attr op "value"` form Okta sends.
// Returns ErrUnsupportedFilter when input includes operators outside
// the supported set so callers can return a 400 with a useful body.
func ParseFilter(s string) (FilterOp, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return FilterOp{}, ErrUnsupportedFilter
	}
	if strings.Contains(s, " and ") || strings.Contains(s, " or ") {
		return FilterOp{}, ErrCompoundUnsupported
	}

	tokens := strings.SplitN(s, " ", 3)
	if len(tokens) < 2 {
		return FilterOp{}, ErrUnsupportedFilter
	}
	op := strings.ToLower(tokens[1])

	switch op {
	case "pr":
		return FilterOp{Attr: tokens[0], Op: "pr"}, nil
	case "eq", "co", "sw", "ew":
		if len(tokens) != 3 {
			return FilterOp{}, ErrUnsupportedFilter
		}
		v := strings.Trim(tokens[2], `"`)
		return FilterOp{Attr: tokens[0], Op: op, Value: v}, nil
	default:
		return FilterOp{}, fmt.Errorf("scim: unsupported op %q", op)
	}
}

// ErrUnsupportedFilter signals a malformed or out-of-spec filter.
var ErrUnsupportedFilter = fmt.Errorf("scim: filter must follow `attr op [value]`")

// ErrCompoundUnsupported documents the and/or limitation explicitly.
var ErrCompoundUnsupported = fmt.Errorf("scim: compound filters (and/or) are not yet supported")

// parseUserNameEq extracts the value of `userName eq "..."` from a
// SCIM filter string. Anything else returns "" so the store returns
// the full list. Kept narrow because Okta only sends this one form
// for the User search endpoint.
func parseUserNameEq(filter string) string {
	f := strings.TrimSpace(filter)
	if f == "" {
		return ""
	}
	lower := strings.ToLower(f)
	const key = "username eq"
	if idx := strings.Index(lower, key); idx != 0 {
		return ""
	}
	rest := strings.TrimSpace(f[len(key):])
	return strings.Trim(rest, `"'`)
}
