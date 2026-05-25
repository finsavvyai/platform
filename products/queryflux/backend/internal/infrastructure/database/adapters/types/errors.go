package types

import "errors"

// Sentinel errors — Phase 1 contract v1.0.0 (see QUERY_CONTRACT.md §3).
// All adapters MUST set AdapterError.sentinel via WithSentinel(...) so that
// callers can use errors.Is(err, ErrTimeout) and similar.
var (
	ErrTimeout      = errors.New("queryflux: query timeout")
	ErrAuthFail     = errors.New("queryflux: authentication failed")
	ErrSyntax       = errors.New("queryflux: query syntax error")
	ErrConnection   = errors.New("queryflux: connection error")
	ErrPermission   = errors.New("queryflux: permission denied")
	ErrInvalidParam = errors.New("queryflux: invalid parameter")
	ErrMaxRows      = errors.New("queryflux: max rows exceeded")
	ErrNotConnected = errors.New("queryflux: not connected")
)

// WithSentinel attaches a sentinel error to an AdapterError so errors.Is
// works against the canonical Phase 1 taxonomy.
func (e *AdapterError) WithSentinel(s error) *AdapterError {
	e.sentinel = s
	return e
}

// Unwrap returns the underlying sentinel for errors.Is / errors.As.
func (e *AdapterError) Unwrap() error {
	return e.sentinel
}

// Is reports whether the target matches this AdapterError's sentinel.
// Falls back to identity comparison if no sentinel is set.
func (e *AdapterError) Is(target error) bool {
	if e == nil || target == nil {
		return false
	}
	if e.sentinel != nil && errors.Is(e.sentinel, target) {
		return true
	}
	return false
}
