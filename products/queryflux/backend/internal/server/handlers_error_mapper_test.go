package server

import (
	"errors"
	"fmt"
	"testing"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

func TestMapAdapterErrorToHTTP(t *testing.T) {
	cases := []struct {
		name string
		err  error
		code int
	}{
		{"nil maps to 200", nil, 200},
		{"timeout sentinel", types.ErrTimeout, 504},
		{"auth fail sentinel", types.ErrAuthFail, 401},
		{"syntax sentinel", types.ErrSyntax, 400},
		{"permission sentinel", types.ErrPermission, 403},
		{"connection sentinel", types.ErrConnection, 503},
		{"invalid param sentinel", types.ErrInvalidParam, 400},
		{"max rows sentinel", types.ErrMaxRows, 413},
		{"not connected sentinel", types.ErrNotConnected, 503},
		{"wrapped timeout still maps", fmt.Errorf("oops: %w", types.ErrTimeout), 504},
		{"double-wrapped auth still maps", fmt.Errorf("outer: %w", fmt.Errorf("inner: %w", types.ErrAuthFail)), 401},
		{"unknown error falls back to 500", errors.New("totally unknown driver text"), 500},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := MapAdapterErrorToHTTP(tc.err); got != tc.code {
				t.Errorf("MapAdapterErrorToHTTP(%v) = %d, want %d", tc.err, got, tc.code)
			}
		})
	}
}

func TestSafeErrorMessage(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want string
	}{
		{"nil returns empty", nil, ""},
		{"timeout returns stable text", types.ErrTimeout, types.ErrTimeout.Error()},
		{"auth fail returns stable text", types.ErrAuthFail, types.ErrAuthFail.Error()},
		{"syntax returns stable text", types.ErrSyntax, types.ErrSyntax.Error()},
		{"permission returns stable text", types.ErrPermission, types.ErrPermission.Error()},
		{"connection returns stable text", types.ErrConnection, types.ErrConnection.Error()},
		{"invalid param returns stable text", types.ErrInvalidParam, types.ErrInvalidParam.Error()},
		{"max rows returns stable text", types.ErrMaxRows, types.ErrMaxRows.Error()},
		{"not connected returns stable text", types.ErrNotConnected, types.ErrNotConnected.Error()},
		{"wrapped syntax returns sentinel text", fmt.Errorf("at line 12: %w", types.ErrSyntax), types.ErrSyntax.Error()},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := SafeErrorMessage(tc.err); got != tc.want {
				t.Errorf("SafeErrorMessage(%v) = %q, want %q", tc.err, got, tc.want)
			}
		})
	}

	t.Run("unknown error never leaks raw text", func(t *testing.T) {
		secretish := errors.New("connection failed for user=admin password=hunter2 host=db.internal")
		got := SafeErrorMessage(secretish)
		if got != "internal error" {
			t.Fatalf("SafeErrorMessage(unknown) = %q, want %q", got, "internal error")
		}
	})
}

// TestMapAndMessageAgree pins the invariant that every sentinel produces
// both a status code AND a stable message, so the two helpers never drift.
func TestMapAndMessageAgree(t *testing.T) {
	sentinels := []error{
		types.ErrTimeout, types.ErrAuthFail, types.ErrSyntax,
		types.ErrPermission, types.ErrConnection, types.ErrInvalidParam,
		types.ErrMaxRows, types.ErrNotConnected,
	}
	for _, s := range sentinels {
		if MapAdapterErrorToHTTP(s) == 500 {
			t.Errorf("sentinel %v fell through to 500", s)
		}
		if SafeErrorMessage(s) == "internal error" {
			t.Errorf("sentinel %v fell through to generic message", s)
		}
	}
}
