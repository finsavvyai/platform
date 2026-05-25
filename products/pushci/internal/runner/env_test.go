package runner_test

import (
	"context"
	"errors"
	"testing"

	"github.com/finsavvyai/pushci/internal/runner"
)

type mockResolver struct {
	val string
	err error
}

func (m mockResolver) Resolve(_ context.Context, _ string) (string, error) { return m.val, m.err }
func (m mockResolver) Close() error                                        { return nil }

func TestResolveEnv(t *testing.T) {
	errVault := errors.New("vault: not found")
	cases := []struct {
		name    string
		env     map[string]string
		res     mockResolver
		wantErr bool
		key     string
		wantVal string
	}{
		{
			name:    "non-vault passthrough",
			env:     map[string]string{"KEY": "plain-value"},
			res:     mockResolver{},
			key:     "KEY",
			wantVal: "plain-value",
		},
		{
			name:    "vault ref resolved",
			env:     map[string]string{"TOKEN": "vault://secret/data/pilot/maven#token"},
			res:     mockResolver{val: "resolved-secret"},
			key:     "TOKEN",
			wantVal: "resolved-secret",
		},
		{
			name:    "vault error propagated",
			env:     map[string]string{"BAD": "vault://secret/data/missing#field"},
			res:     mockResolver{err: errVault},
			wantErr: true,
		},
		{
			name:    "keychain ref resolved",
			env:     map[string]string{"NPM": "keychain://npm-publish-token"},
			res:     mockResolver{val: "npm_resolved"},
			key:     "NPM",
			wantVal: "npm_resolved",
		},
		{
			name: "nil env ok",
			env:  nil,
			res:  mockResolver{},
		},
		{
			name:    "empty env ok",
			env:     map[string]string{},
			res:     mockResolver{},
			wantErr: false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Same mock serves both schemes — sufficient because the
			// production resolverForScheme switch picks by prefix and
			// each test case only exercises one scheme.
			got, err := runner.ResolveEnv(context.Background(), tc.env, tc.res, tc.res)
			if tc.wantErr {
				if err == nil {
					t.Fatal("want error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tc.key != "" && got[tc.key] != tc.wantVal {
				t.Errorf("got %q, want %q", got[tc.key], tc.wantVal)
			}
		})
	}
}
