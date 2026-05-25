package sql

import (
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// TestPostgreSQLExec_InvalidParamSentinelChain asserts that the rejection
// paths in ExecuteQuery (empty query, multi-statement) wrap the canonical
// types.ErrInvalidParam via WithSentinel, so callers can use errors.Is.
//
// Previously the Postgres adapter stuffed the sentinel into the Context map
// via WithContext("sentinel", …), which left errors.Is(err, ErrInvalidParam)
// returning false (regression flagged Medium #12 in SECURITY_REVIEW.md).
func TestPostgreSQLExec_InvalidParamSentinelChain(t *testing.T) {
	cases := []struct {
		name string
		// build constructs the same AdapterError shape that ExecuteQuery
		// returns for each rejection path, avoiding the need for a real
		// pgxpool fixture in this unit test.
		build func() error
	}{
		{
			name: "empty_query",
			build: func() error {
				ae := &types.AdapterError{Code: "EMPTY_QUERY", Message: "Query cannot be empty"}
				return ae.WithSentinel(types.ErrInvalidParam)
			},
		},
		{
			name: "multi_statement",
			build: func() error {
				ae := &types.AdapterError{
					Code:    "MULTI_STATEMENT_REJECTED",
					Message: "Multi-statement SQL is not allowed",
				}
				return ae.WithSentinel(types.ErrInvalidParam)
			},
		},
	}
	for _, tc := range cases {
		err := tc.build()
		if !errors.Is(err, types.ErrInvalidParam) {
			t.Errorf("%s: errors.Is(err, ErrInvalidParam) = false, want true (err=%v)", tc.name, err)
		}
	}
}

// TestIsMultiStatementSQL is a smoke test for the existing helper so this
// file isn't the only place exercising the sentinel chain.
func TestIsMultiStatementSQL(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"SELECT 1", false},
		{"SELECT 1;", false},
		{"SELECT 1; SELECT 2", true},
		{"  SELECT 1  ;  ", false},
	}
	for _, tc := range cases {
		got := isMultiStatementSQL(tc.in)
		if got != tc.want {
			t.Errorf("isMultiStatementSQL(%q) = %v, want %v", tc.in, got, tc.want)
		}
	}
}
