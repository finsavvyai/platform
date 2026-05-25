package llm

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeProvider struct {
	name string
	resp *Response
	err  error
}

func (f *fakeProvider) Name() string { return f.name }
func (f *fakeProvider) Generate(_ context.Context, _ Request) (*Response, error) {
	return f.resp, f.err
}
func (f *fakeProvider) Embed(_ context.Context, in []string) ([][]float32, error) {
	out := make([][]float32, len(in))
	for i := range in {
		out[i] = []float32{0.1, 0.2}
	}
	return out, nil
}

func TestFallback_FirstSucceeds(t *testing.T) {
	c := NewFallbackChain(
		FallbackConfig{Primary: "anthropic", Secondaries: []string{"openai"}},
		&fakeProvider{name: "anthropic", resp: &Response{Content: "ok"}},
		&fakeProvider{name: "openai", err: errors.New("should not be called")},
	)
	r, err := c.Generate(context.Background(), Request{})
	if err != nil || r.Content != "ok" {
		t.Fatalf("primary success path: r=%+v err=%v", r, err)
	}
}

func TestFallback_FailoversOnTransient(t *testing.T) {
	c := NewFallbackChain(
		FallbackConfig{Primary: "anthropic", Secondaries: []string{"openai"}},
		&fakeProvider{name: "anthropic", err: Transient(errors.New("502 bad gateway"))},
		&fakeProvider{name: "openai", resp: &Response{Content: "rescued"}},
	)
	r, err := c.Generate(context.Background(), Request{})
	if err != nil || r.Content != "rescued" {
		t.Fatalf("failover path: r=%+v err=%v", r, err)
	}
}

func TestFallback_PermanentDoesNotFailover(t *testing.T) {
	called := false
	c := NewFallbackChain(
		FallbackConfig{Primary: "anthropic", Secondaries: []string{"openai"}},
		&fakeProvider{name: "anthropic", err: errors.New("400 bad request")},
		&fakeProvider{name: "openai", resp: nil, err: nil},
	)
	// Replace openai with a tracker.
	c.providers["openai"] = &spyProvider{name: "openai", calledFlag: &called}
	_, err := c.Generate(context.Background(), Request{})
	if err == nil {
		t.Fatal("permanent error must surface")
	}
	if called {
		t.Fatal("permanent failure must NOT advance to secondary")
	}
}

func TestFallback_AllFail_JoinsErrors(t *testing.T) {
	c := NewFallbackChain(
		FallbackConfig{Primary: "anthropic", Secondaries: []string{"openai"}},
		&fakeProvider{name: "anthropic", err: Transient(errors.New("rate limited"))},
		&fakeProvider{name: "openai", err: Transient(errors.New("server error"))},
	)
	_, err := c.Generate(context.Background(), Request{})
	if err == nil {
		t.Fatal("all-fail must error")
	}
	msg := err.Error()
	if !strings.Contains(msg, "anthropic") || !strings.Contains(msg, "openai") {
		t.Fatalf("joined error must include every vendor: %q", msg)
	}
}

func TestFallback_EmptyChain_ErrNoProviders(t *testing.T) {
	c := NewFallbackChain(FallbackConfig{})
	_, err := c.Generate(context.Background(), Request{})
	if !errors.Is(err, ErrNoProviders) {
		t.Fatalf("empty chain must be ErrNoProviders, got %v", err)
	}
}

type spyProvider struct {
	name       string
	calledFlag *bool
}

func (s *spyProvider) Name() string { return s.name }
func (s *spyProvider) Generate(_ context.Context, _ Request) (*Response, error) {
	*s.calledFlag = true
	return &Response{Content: "should-not-see"}, nil
}
func (s *spyProvider) Embed(_ context.Context, _ []string) ([][]float32, error) {
	return nil, nil
}
