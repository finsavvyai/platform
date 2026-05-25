package ai

import (
	"context"
	"time"
)

// RetryProvider wraps another Provider with exponential-backoff
// retries on transient errors. Permanent errors (4xx, parse failures)
// pass through immediately so a misconfigured key doesn't waste 3
// attempts × 2 providers × backoff seconds before failing.
type RetryProvider struct {
	inner    Provider
	attempts int
	base     time.Duration
}

// NewRetryProvider wraps inner with up to attempts attempts (so
// attempts=3 means 1 try + 2 retries). base is the first backoff
// delay; subsequent attempts double it (capped at 4× base).
func NewRetryProvider(inner Provider, attempts int, base time.Duration) *RetryProvider {
	if attempts < 1 {
		attempts = 1
	}
	return &RetryProvider{inner: inner, attempts: attempts, base: base}
}

// IsConfigured forwards to the wrapped provider.
func (r *RetryProvider) IsConfigured() bool { return r.inner.IsConfigured() }

// Name forwards (so observability still logs "anthropic" not "retry").
func (r *RetryProvider) Name() string { return r.inner.Name() }

// Complete tries up to attempts times. Sleeps base, 2*base, 4*base
// between attempts for exponential backoff.
func (r *RetryProvider) Complete(ctx context.Context, prompt string) (string, error) {
	var err error
	delay := r.base
	for i := 0; i < r.attempts; i++ {
		if i > 0 {
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(delay):
			}
			if delay < 4*r.base {
				delay *= 2
			}
		}
		var out string
		out, err = r.inner.Complete(ctx, prompt)
		if err == nil {
			return out, nil
		}
		if !isTransient(err) {
			return "", err
		}
	}
	return "", err
}
