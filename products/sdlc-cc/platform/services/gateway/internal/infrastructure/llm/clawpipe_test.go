package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// clawStub holds the last request the test server received so tests can
// assert on headers and body without reaching the live API.
type clawStub struct {
	code    int
	body    string
	lastReq *http.Request
	lastRaw []byte
}

func (s *clawStub) serve(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.lastReq = r
		s.lastRaw, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(s.code)
		_, _ = w.Write([]byte(s.body))
	}))
}

// TestClawPipe_RequestShape verifies the adapter sends the correct
// Authorization header, X-Project-Id header, and JSON body shape.
func TestClawPipe_RequestShape(t *testing.T) {
	stub := &clawStub{
		code: 200,
		body: `{"text":"hello","tokensIn":10,"tokensOut":5,"latencyMs":42}`,
	}
	srv := stub.serve(t)
	defer srv.Close()

	cp := NewClawPipe("cp_test_key", "sdlc-test", srv.URL)
	req := Request{
		Model:     "claude-3-5-haiku",
		MaxTokens: 256,
		Messages: []Message{
			{Role: "system", Content: "You are helpful."},
			{Role: "user", Content: "Say hello."},
		},
	}
	_, err := cp.Generate(context.Background(), req)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	// Authorization header.
	if got := stub.lastReq.Header.Get("Authorization"); got != "Bearer cp_test_key" {
		t.Errorf("Authorization: want 'Bearer cp_test_key', got %q", got)
	}
	// Project-ID header.
	if got := stub.lastReq.Header.Get("X-Project-Id"); got != "sdlc-test" {
		t.Errorf("X-Project-Id: want 'sdlc-test', got %q", got)
	}
	// Path.
	if stub.lastReq.URL.Path != "/v1/prompt" {
		t.Errorf("path: want /v1/prompt, got %q", stub.lastReq.URL.Path)
	}
	// Body shape.
	var body clawRequest
	if err := json.Unmarshal(stub.lastRaw, &body); err != nil {
		t.Fatalf("decode request body: %v", err)
	}
	if body.System != "You are helpful." {
		t.Errorf("system: want 'You are helpful.', got %q", body.System)
	}
	if body.Prompt != "user: Say hello." {
		t.Errorf("prompt: want 'user: Say hello.', got %q", body.Prompt)
	}
	if body.Model != "claude-3-5-haiku" {
		t.Errorf("model: want 'claude-3-5-haiku', got %q", body.Model)
	}
	if body.MaxTokens != 256 {
		t.Errorf("maxTokens: want 256, got %d", body.MaxTokens)
	}
}

// TestClawPipe_ResponseUnmarshal verifies text/tokensIn/tokensOut/latencyMs
// map correctly to the shared Response type.
func TestClawPipe_ResponseUnmarshal(t *testing.T) {
	stub := &clawStub{
		code: 200,
		body: `{"text":"pong","tokensIn":7,"tokensOut":3,"latencyMs":100}`,
	}
	srv := stub.serve(t)
	defer srv.Close()

	cp := NewClawPipe("key", "", srv.URL)
	resp, err := cp.Generate(context.Background(), Request{
		Model:    "gpt-4o",
		Messages: []Message{{Role: "user", Content: "ping"}},
	})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if resp.Content != "pong" {
		t.Errorf("Content: want 'pong', got %q", resp.Content)
	}
	if resp.PromptTokens != 7 {
		t.Errorf("PromptTokens: want 7, got %d", resp.PromptTokens)
	}
	if resp.CompletionTokens != 3 {
		t.Errorf("CompletionTokens: want 3, got %d", resp.CompletionTokens)
	}
	if resp.Latency.Milliseconds() != 100 {
		t.Errorf("Latency: want 100ms, got %v", resp.Latency)
	}
	if resp.Provider != "clawpipe" {
		t.Errorf("Provider: want 'clawpipe', got %q", resp.Provider)
	}
}

// TestClawPipe_FivezeroTwoIsTransient verifies a 502 from ClawPipe is
// marked Transient so the FallbackChain advances to the next provider
// rather than hard-failing the request.
func TestClawPipe_FivezeroTwoIsTransient(t *testing.T) {
	stub := &clawStub{code: 502, body: `{"error":"upstream timeout"}`}
	srv := stub.serve(t)
	defer srv.Close()

	cp := NewClawPipe("key", "", srv.URL)
	_, err := cp.Generate(context.Background(), Request{
		Model:    "any",
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err == nil {
		t.Fatal("want error on 502, got nil")
	}
	if !IsTransient(err) {
		t.Errorf("502 should be Transient for fallback chain; IsTransient returned false. err=%v", err)
	}
}

// TestClawPipe_FallbackChainAdvancesOnClawPipeFailure proves that when
// ClawPipe returns 502, a FallbackChain with an httptest-backed secondary
// (stub Anthropic) still returns a successful response.
func TestClawPipe_FallbackChainAdvancesOnClawPipeFailure(t *testing.T) {
	// ClawPipe always 502s.
	clawStubSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(502)
		_, _ = w.Write([]byte(`{"error":"down"}`))
	}))
	defer clawStubSrv.Close()

	// Secondary: a minimal Anthropic-compatible stub.
	anthropicStubSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"content":[{"type":"text","text":"fallback ok"}],"model":"claude-3-5-haiku","stop_reason":"end_turn","usage":{"input_tokens":5,"output_tokens":4}}`))
	}))
	defer anthropicStubSrv.Close()

	clawPipe := NewClawPipe("key", "", clawStubSrv.URL)
	anthropic := NewAnthropic("key", anthropicStubSrv.URL)

	chain := NewFallbackChain(
		FallbackConfig{Primary: "clawpipe", Secondaries: []string{"anthropic"}},
		clawPipe, anthropic,
	)

	resp, err := chain.Generate(context.Background(), Request{
		Model:    "claude-3-5-haiku",
		Messages: []Message{{Role: "user", Content: "test"}},
	})
	if err != nil {
		t.Fatalf("chain.Generate: expected fallback success, got error: %v", err)
	}
	if resp.Content != "fallback ok" {
		t.Errorf("Content: want 'fallback ok', got %q", resp.Content)
	}
}

// TestClawPipe_NoProjectIDHeader verifies that when projectID is empty,
// the X-Project-Id header is not sent (not an empty string header).
func TestClawPipe_NoProjectIDHeader(t *testing.T) {
	stub := &clawStub{code: 200, body: `{"text":"ok","tokensIn":1,"tokensOut":1}`}
	srv := stub.serve(t)
	defer srv.Close()

	cp := NewClawPipe("key", "", srv.URL)
	_, err := cp.Generate(context.Background(), Request{
		Model:    "gpt-4o",
		Messages: []Message{{Role: "user", Content: "x"}},
	})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if h := stub.lastReq.Header.Get("X-Project-Id"); h != "" {
		t.Errorf("X-Project-Id should be absent when projectID is empty, got %q", h)
	}
}

// TestSplitMessages verifies multi-turn conversation formatting.
func TestSplitMessages(t *testing.T) {
	msgs := []Message{
		{Role: "system", Content: "sys"},
		{Role: "user", Content: "q1"},
		{Role: "assistant", Content: "a1"},
		{Role: "user", Content: "q2"},
	}
	sys, prompt := splitMessages(msgs)
	if sys != "sys" {
		t.Errorf("system: want 'sys', got %q", sys)
	}
	want := "user: q1\nassistant: a1\nuser: q2"
	if prompt != want {
		t.Errorf("prompt: want %q, got %q", want, prompt)
	}
}
