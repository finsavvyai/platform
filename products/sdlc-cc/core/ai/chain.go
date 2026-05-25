package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// Provider is the minimal surface a fallback chain link needs.
// AnthropicClient + BedrockClient both implement it; tests can
// substitute fakes without touching the package.
type Provider interface {
	IsConfigured() bool
	Complete(ctx context.Context, prompt string) (string, error)
	Name() string
}

// FallbackChain tries providers in order. On a transient error
// (network failure, 5xx, timeout) it falls through to the next.
// On a permanent error (4xx response from the provider — usually
// auth or rate-limit) it returns immediately so we don't burn
// every provider's quota on a configuration mistake.
type FallbackChain struct {
	providers []Provider
	last      string
}

// NewFallbackChain builds a chain in priority order. Unconfigured
// providers are filtered out at construction so a missing AWS key
// doesn't insert a always-failing link in the middle of the chain.
func NewFallbackChain(providers ...Provider) *FallbackChain {
	live := make([]Provider, 0, len(providers))
	for _, p := range providers {
		if p != nil && p.IsConfigured() {
			live = append(live, p)
		}
	}
	return &FallbackChain{providers: live}
}

// IsConfigured reports whether any underlying provider is live.
// FallbackChain with zero live providers is functionally equivalent
// to no AI configured — callers branch on this for the 503 path.
func (f *FallbackChain) IsConfigured() bool {
	return f != nil && len(f.providers) > 0
}

// Complete tries each provider in order. Transient errors (network,
// 5xx) fall through; permanent errors (4xx, parse failures) bubble
// up immediately. The last provider's error is returned when the
// whole chain exhausts.
func (f *FallbackChain) Complete(ctx context.Context, prompt string) (string, error) {
	if !f.IsConfigured() {
		return "", errors.New("fallback: no providers configured")
	}
	var lastErr error
	for _, p := range f.providers {
		f.last = p.Name()
		out, err := p.Complete(ctx, prompt)
		if err == nil {
			return out, nil
		}
		lastErr = err
		if !isTransient(err) {
			return "", fmt.Errorf("%s: %w", p.Name(), err)
		}
	}
	return "", fmt.Errorf("fallback exhausted (%d providers): %w",
		len(f.providers), lastErr)
}

// LastUsed returns the name of the most-recently-tried provider.
// Lets observability log which backend served (or last-tried) a call.
func (f *FallbackChain) LastUsed() string { return f.last }

// Name implements Provider so the chain can itself be wrapped.
func (f *FallbackChain) Name() string { return "fallback-chain" }

// isTransient classifies errors as worth retrying / falling through.
// Heuristic: 5xx in error string, "timeout", "network", "EOF",
// "connection refused". 4xx (auth, validation) is permanent.
func isTransient(err error) bool {
	s := strings.ToLower(err.Error())
	for _, marker := range []string{
		"5xx", "503", "502", "504", "500",
		"timeout", "deadline", "network",
		"eof", "connection refused", "transient",
	} {
		if strings.Contains(s, marker) {
			return true
		}
	}
	return false
}
