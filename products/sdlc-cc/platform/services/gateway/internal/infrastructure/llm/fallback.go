// Package llm — fallback chain.
//
// Day 49 deliverable: configurable provider fallback that distinguishes
// transient (5xx, network, timeout) from permanent (4xx) failures.
// Permanent errors short-circuit; transient errors advance to the next
// secondary in priority order.
package llm

import (
	"context"
	"errors"
	"net"
)

// FallbackConfig is the per-tenant routing knob.
//
// Primary is the preferred provider name (e.g. "anthropic").
// Secondaries is the ordered list to try on transient failures.
type FallbackConfig struct {
	Primary     string
	Secondaries []string
}

// FallbackChain wraps providers and dispatches via FallbackConfig.
//
// The chain looks providers up by Name(); unknown names in the config
// are skipped with a recorded error so misconfiguration is visible
// in the joined error rather than silently swallowed.
type FallbackChain struct {
	providers map[string]Provider
	cfg       FallbackConfig
}

// NewFallbackChain accepts the providers in any order; lookup is by
// Name(). The config drives priority.
func NewFallbackChain(cfg FallbackConfig, providers ...Provider) *FallbackChain {
	m := make(map[string]Provider, len(providers))
	for _, p := range providers {
		m[p.Name()] = p
	}
	return &FallbackChain{providers: m, cfg: cfg}
}

// Name implements Provider so the chain itself can be passed wherever
// a single provider is expected. Returns "fallback-chain" so audit
// rows distinguish chain-routed responses from a direct adapter call.
func (c *FallbackChain) Name() string { return "fallback-chain" }

// Embed delegates to the Primary provider only. Embeddings are
// generally per-vendor and cross-vendor fallback would silently change
// the embedding space mid-corpus — far worse than a hard error.
func (c *FallbackChain) Embed(ctx context.Context, input []string) ([][]float32, error) {
	if c.cfg.Primary == "" {
		return nil, ErrNoProviders
	}
	p, ok := c.providers[c.cfg.Primary]
	if !ok {
		return nil, ErrNoProviders
	}
	return p.Embed(ctx, input)
}

// Generate tries Primary, then Secondaries in order. Any provider that
// returns a non-transient error short-circuits the chain.
func (c *FallbackChain) Generate(ctx context.Context, req Request) (*Response, error) {
	order := c.order()
	if len(order) == 0 {
		return nil, ErrNoProviders
	}
	var errs []error
	for _, name := range order {
		p, ok := c.providers[name]
		if !ok {
			errs = append(errs, providerErr{name: name, err: errors.New("provider not registered")})
			continue
		}
		resp, err := p.Generate(ctx, req)
		if err == nil {
			return resp, nil
		}
		errs = append(errs, providerErr{name: name, err: err})
		if !IsTransient(err) {
			// Permanent failure — do not advance.
			return nil, errors.Join(errs...)
		}
	}
	return nil, errors.Join(errs...)
}

func (c *FallbackChain) order() []string {
	out := make([]string, 0, 1+len(c.cfg.Secondaries))
	if c.cfg.Primary != "" {
		out = append(out, c.cfg.Primary)
	}
	out = append(out, c.cfg.Secondaries...)
	return out
}

// transientError is a sentinel-bearing wrapper providers use to mark
// errors as retriable (5xx, timeouts, connection resets).
type transientError struct{ err error }

func (t transientError) Error() string { return t.err.Error() }
func (t transientError) Unwrap() error { return t.err }

// Transient wraps err so the FallbackChain advances to the next provider.
func Transient(err error) error {
	if err == nil {
		return nil
	}
	return transientError{err: err}
}

// IsTransient reports whether err should trigger a fallback. Network
// errors and explicitly-wrapped Transient values qualify; bare 4xx
// errors from providers do not.
func IsTransient(err error) bool {
	if err == nil {
		return false
	}
	var te transientError
	if errors.As(err, &te) {
		return true
	}
	var ne net.Error
	if errors.As(err, &ne) {
		return true
	}
	return false
}

type providerErr struct {
	name string
	err  error
}

func (p providerErr) Error() string { return p.name + ": " + p.err.Error() }
func (p providerErr) Unwrap() error { return p.err }
