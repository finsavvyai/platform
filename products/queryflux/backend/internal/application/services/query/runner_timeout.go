package query

import (
	"context"
	"errors"
	"regexp"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// WithTimeout returns a derived context bounded by d. If d <= 0 the
// caller's context is returned unchanged with a no-op cancel; the
// runner default has already been applied by applyDefaults so the
// only way to land here with d <= 0 is an explicit opt-out for
// long-running streaming workloads.
func WithTimeout(parent context.Context, d time.Duration) (context.Context, context.CancelFunc) {
	if d <= 0 {
		return parent, func() {}
	}
	return context.WithTimeout(parent, d)
}

// applyDefaults stamps DefaultTimeout, DefaultMaxRows and
// DefaultBatchSize onto any zero-valued QueryOptions fields. Callers
// pass options by value so the original is never mutated.
func applyDefaults(o QueryOptions) QueryOptions {
	if o.Timeout == 0 {
		o.Timeout = DefaultTimeout
	}
	if o.MaxRows == 0 {
		o.MaxRows = DefaultMaxRows
	}
	if o.BatchSize == 0 {
		o.BatchSize = DefaultBatchSize
	}
	return o
}

// classifyCtxErr promotes context.DeadlineExceeded / Canceled into a
// typed ErrTimeout so audit logs and HTTP status mapping work. It
// preserves the original adapter error via fmt.Errorf wrap chain.
func classifyCtxErr(ctx context.Context, err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return wrapSentinel(types.ErrTimeout, err)
	}
	if errors.Is(err, context.Canceled) || errors.Is(ctx.Err(), context.Canceled) {
		return wrapSentinel(types.ErrTimeout, err)
	}
	return err
}

// wrapSentinel produces an error whose Is(target) returns true for
// sentinel while still surfacing the original message via Error().
func wrapSentinel(sentinel, original error) error {
	return &sentinelWrap{sentinel: sentinel, inner: original}
}

type sentinelWrap struct {
	sentinel error
	inner    error
}

func (w *sentinelWrap) Error() string {
	if w.inner == nil {
		return w.sentinel.Error()
	}
	return w.sentinel.Error() + ": " + w.inner.Error()
}

func (w *sentinelWrap) Is(target error) bool {
	return errors.Is(w.sentinel, target) || errors.Is(w.inner, target)
}

func (w *sentinelWrap) Unwrap() error { return w.inner }

// Credential redaction patterns. The runner runs every error message
// through these regexes before returning to a caller so secrets that
// leaked into driver error strings never reach handlers or logs.
var redactPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(password|pwd|passwd)\s*=\s*[^\s&;]+`),
	regexp.MustCompile(`(?i)(secret|token|api[_-]?key)\s*=\s*[^\s&;]+`),
	regexp.MustCompile(`(?i)://[^:@\s/]+:[^@\s/]+@`),
	regexp.MustCompile(`(?i)authorization:\s*bearer\s+\S+`),
}

// RedactString masks credentials inside s. Exported so the audit
// logger and tests can share the same scrubber.
func RedactString(s string) string {
	out := s
	for _, p := range redactPatterns {
		out = p.ReplaceAllStringFunc(out, scrubMatch)
	}
	return out
}

// scrubMatch replaces the value half of a key=value match with `***`.
// Falls back to a full mask for URL-userinfo and bearer-token forms.
func scrubMatch(m string) string {
	if i := indexOfEqual(m); i > 0 {
		return m[:i+1] + "***"
	}
	if i := indexOfColon(m); i > 0 && i < len(m)-1 {
		// scheme://user:***@
		return m[:i+1] + "***@"
	}
	return "***"
}

func indexOfEqual(s string) int {
	for i, c := range s {
		if c == '=' {
			return i
		}
	}
	return -1
}

func indexOfColon(s string) int {
	// returns index of the SECOND `:` so we keep `scheme:` intact.
	first := -1
	for i, c := range s {
		if c == ':' {
			if first == -1 {
				first = i
				continue
			}
			return i
		}
	}
	return -1
}

// redactErr wraps an error with a credential-scrubbed message while
// preserving the original chain for errors.Is / errors.As lookups.
func redactErr(err error) error {
	if err == nil {
		return nil
	}
	msg := RedactString(err.Error())
	if msg == err.Error() {
		return err
	}
	return &redactedError{msg: msg, inner: err}
}

type redactedError struct {
	msg   string
	inner error
}

func (e *redactedError) Error() string { return e.msg }
func (e *redactedError) Unwrap() error { return e.inner }

// annotateTruncated stores the truncation hint on the QueryResult.
// Phase 1 contract amendment adds a real Truncated bool; until that
// lands we piggy-back on the Query field with a stable marker so the
// handler layer can detect it without a schema change.
func annotateTruncated(r *types.QueryResult, truncated bool) {
	if !truncated {
		return
	}
	if r.Query == "" {
		r.Query = "[truncated]"
		return
	}
	r.Query = "[truncated] " + r.Query
}
