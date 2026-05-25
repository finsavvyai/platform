package runner

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/secrets"
)

// ResolveEnv expands secret references in env values before injection
// into shell commands. Recognized schemes: vault://, keychain://.
// Plain values are copied unchanged. The matching resolver is consulted
// per scheme — pass nil for a scheme you don't want to support and any
// matching ref will fail. Returns the first resolution error.
func ResolveEnv(ctx context.Context, env map[string]string, vault, keychain secrets.Resolver) (map[string]string, error) {
	if len(env) == 0 {
		return env, nil
	}
	out := make(map[string]string, len(env))
	for k, v := range env {
		r := resolverForScheme(v, vault, keychain)
		if r == nil {
			out[k] = v
			continue
		}
		resolved, err := r.Resolve(ctx, v)
		if err != nil {
			return nil, fmt.Errorf("env %s: %w", k, err)
		}
		out[k] = resolved
	}
	return out, nil
}

// resolverForScheme returns the resolver matching the URI prefix on
// the value, or nil when the value is a plain (non-secret) literal.
// A nil return from a recognized scheme means the caller passed nil
// for that scheme — propagate as "scheme not configured" upstream.
func resolverForScheme(v string, vault, keychain secrets.Resolver) secrets.Resolver {
	switch {
	case strings.HasPrefix(v, "vault://"):
		return vault
	case strings.HasPrefix(v, "keychain://"):
		return keychain
	default:
		return nil
	}
}
