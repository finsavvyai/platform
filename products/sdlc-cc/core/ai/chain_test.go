package ai

import (
	"context"
	"errors"
	"testing"
	"time"
)

// fakeProvider is a deterministic Provider for chain tests.
type fakeProvider struct {
	name       string
	configured bool
	out        string
	err        error
}

func (f *fakeProvider) IsConfigured() bool { return f.configured }
func (f *fakeProvider) Name() string       { return f.name }
func (f *fakeProvider) Complete(_ context.Context, _ string) (string, error) {
	return f.out, f.err
}

func TestFallbackChain_PrimarySucceeds(t *testing.T) {
	p1 := &fakeProvider{name: "p1", configured: true, out: "ok"}
	p2 := &fakeProvider{name: "p2", configured: true, out: "should-not-reach"}
	chain := NewFallbackChain(p1, p2)
	got, err := chain.Complete(context.Background(), "hello")
	if err != nil || got != "ok" {
		t.Fatalf("got=%q err=%v", got, err)
	}
	if chain.LastUsed() != "p1" {
		t.Errorf("expected last=p1, got %q", chain.LastUsed())
	}
}

func TestFallbackChain_TransientFallsThrough(t *testing.T) {
	p1 := &fakeProvider{name: "p1", configured: true,
		err: errors.New("503 service unavailable")}
	p2 := &fakeProvider{name: "p2", configured: true, out: "fallback-success"}
	chain := NewFallbackChain(p1, p2)
	got, err := chain.Complete(context.Background(), "hello")
	if err != nil || got != "fallback-success" {
		t.Fatalf("got=%q err=%v", got, err)
	}
	if chain.LastUsed() != "p2" {
		t.Errorf("expected last=p2, got %q", chain.LastUsed())
	}
}

func TestFallbackChain_PermanentStopsImmediately(t *testing.T) {
	p1 := &fakeProvider{name: "p1", configured: true,
		err: errors.New("400 invalid request")}
	p2 := &fakeProvider{name: "p2", configured: true, out: "should-not-reach"}
	chain := NewFallbackChain(p1, p2)
	_, err := chain.Complete(context.Background(), "hello")
	if err == nil {
		t.Fatal("expected error to bubble up")
	}
	if chain.LastUsed() != "p1" {
		t.Errorf("expected last=p1 (didn't try p2), got %q", chain.LastUsed())
	}
}

func TestFallbackChain_FiltersUnconfigured(t *testing.T) {
	p1 := &fakeProvider{name: "p1", configured: false}
	p2 := &fakeProvider{name: "p2", configured: true, out: "live"}
	chain := NewFallbackChain(p1, p2)
	if !chain.IsConfigured() {
		t.Fatal("chain should be configured (p2 is live)")
	}
	got, _ := chain.Complete(context.Background(), "hi")
	if got != "live" {
		t.Errorf("got %q want live", got)
	}
}

func TestFallbackChain_ZeroLiveProviders(t *testing.T) {
	p1 := &fakeProvider{name: "p1", configured: false}
	chain := NewFallbackChain(p1, nil)
	if chain.IsConfigured() {
		t.Error("chain with no live providers should be unconfigured")
	}
}

// sequencedProvider returns a programmed response sequence — first
// transient errors, then a success. Lets us deterministically verify
// retry behaviour without a separate goroutine mutating shared state
// (which the -race detector would correctly flag).
type sequencedProvider struct {
	name    string
	calls   int
	results []struct {
		out string
		err error
	}
}

func (s *sequencedProvider) IsConfigured() bool { return true }
func (s *sequencedProvider) Name() string       { return s.name }
func (s *sequencedProvider) Complete(_ context.Context, _ string) (string, error) {
	if s.calls >= len(s.results) {
		return "", errors.New("sequence exhausted")
	}
	r := s.results[s.calls]
	s.calls++
	return r.out, r.err
}

func TestRetryProvider_TransientRetries(t *testing.T) {
	inner := &sequencedProvider{
		name: "inner",
		results: []struct {
			out string
			err error
		}{
			{"", errors.New("503 transient")},
			{"", errors.New("503 transient")},
			{"recovered", nil},
		},
	}
	retry := NewRetryProvider(inner, 3, 1*time.Millisecond)
	out, err := retry.Complete(context.Background(), "x")
	if err != nil {
		t.Fatalf("expected recovery, got err=%v", err)
	}
	if out != "recovered" {
		t.Errorf("got %q want recovered", out)
	}
	if inner.calls != 3 {
		t.Errorf("expected 3 calls, got %d", inner.calls)
	}
}

func TestRetryProvider_PermanentNoRetry(t *testing.T) {
	inner := &fakeProvider{name: "inner", configured: true,
		err: errors.New("400 bad request")}
	retry := NewRetryProvider(inner, 3, 1*time.Millisecond)
	start := time.Now()
	_, err := retry.Complete(context.Background(), "x")
	if err == nil {
		t.Fatal("expected error")
	}
	if time.Since(start) > 5*time.Millisecond {
		t.Errorf("permanent error retried (took %v)", time.Since(start))
	}
}
