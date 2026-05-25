// Per-request token-map context plumbing for the DLP tokenize
// action. The inbound leg builds the map; the outbound leg reads
// it. The map never leaves the gateway process.
package middleware

import "context"

type tokenMapCtxKey struct{}

// withTokenMap attaches a TokenMap to ctx. Used by Inbound when the
// tenant policy is `tokenize`.
func withTokenMap(ctx context.Context, m TokenMap) context.Context {
	if len(m) == 0 {
		return ctx
	}
	return context.WithValue(ctx, tokenMapCtxKey{}, m)
}

// tokenMapFromCtx retrieves the TokenMap previously attached by
// Inbound. The bool return is false when no map is present (which
// means the action wasn't `tokenize` for this request).
func tokenMapFromCtx(ctx context.Context) (TokenMap, bool) {
	v, ok := ctx.Value(tokenMapCtxKey{}).(TokenMap)
	return v, ok
}
