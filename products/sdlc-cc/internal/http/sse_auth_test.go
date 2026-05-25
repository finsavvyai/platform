package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestSSE_BadKey_RejectedBeforeStream is the critical compliance
// invariant: a bad sk_sdlc_* must produce 401 BEFORE any SSE bytes
// hit the wire. Otherwise we'd be writing event headers + empty
// content blocks while saying "unauthorized" in a body the client
// already started parsing as text/event-stream.
func TestSSE_BadKey_RejectedBeforeStream(t *testing.T) {
	verifier := fakeVerifier{want: "sk_sdlc_real", tenant: "tnt_x"}

	// Build the same stack as cmd/api/main.go for /v1/messages:
	//   WithAPIKeys → mux → HandleMessages (which forks to stream)
	mux := http.NewServeMux()
	mux.Handle("POST /v1/messages",
		HandleMessages(fakeProvider{configured: true, out: "should-not-stream"},
			nil, nil, nil))
	stack := WithAPIKeys(verifier, mux)

	body, _ := json.Marshal(MessagesRequest{
		Model: "claude-haiku-4-5", MaxTokens: 64, Stream: true,
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer sk_sdlc_wrong")
	rec := httptest.NewRecorder()
	stack.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("bad key + stream=true should be 401, got %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); strings.Contains(got, "text/event-stream") {
		t.Errorf("must not start SSE on auth failure, got Content-Type %q", got)
	}
	if strings.Contains(rec.Body.String(), "event:") {
		t.Errorf("no SSE event bytes should land on 401, body=%q", rec.Body.String())
	}
}

// TestSSE_GoodKey_TenantOnContext exercises the success path: a
// valid sk_sdlc_* makes it through WithAPIKeys, the streaming
// handler runs, and the tenant_id from the key reaches the
// downstream context (we observe it via a captured fakeProvider).
func TestSSE_GoodKey_TenantOnContext(t *testing.T) {
	verifier := fakeVerifier{want: "sk_sdlc_winner", tenant: "tnt_real"}

	var seenTenant string
	probe := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenTenant = TenantIDFromContext(r.Context())
		// Don't actually stream — just record what auth attached.
		w.WriteHeader(http.StatusOK)
	})
	mux := http.NewServeMux()
	mux.Handle("POST /v1/messages", probe)
	stack := WithAPIKeys(verifier, mux)

	body, _ := json.Marshal(MessagesRequest{
		Model: "x", MaxTokens: 64, Stream: true,
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer sk_sdlc_winner")
	rec := httptest.NewRecorder()
	stack.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Fatalf("good key should pass, got %d", rec.Code)
	}
	if seenTenant != "tnt_real" {
		t.Errorf("tenant on context = %q, want tnt_real", seenTenant)
	}
}

// TestSSE_NoKey_PassesThrough_TransparentProxy: streaming requests
// from transparent-proxy customers carry NO sk_sdlc_* (they bring
// their own Anthropic key). The gate must not 401 them.
func TestSSE_NoKey_PassesThrough_TransparentProxy(t *testing.T) {
	verifier := fakeVerifier{want: "irrelevant"}
	called := false
	mux := http.NewServeMux()
	mux.Handle("POST /v1/messages", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
	}))
	stack := WithAPIKeys(verifier, mux)

	body, _ := json.Marshal(MessagesRequest{
		Model: "x", MaxTokens: 64, Stream: true,
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	// Customer's own Anthropic key (sk-ant-*); not ours.
	req.Header.Set("Authorization", "Bearer sk-ant-customer-key")
	stack.ServeHTTP(httptest.NewRecorder(), req)
	if !called {
		t.Error("transparent-proxy bearer must reach the streaming handler")
	}
}

// Sanity: confirm that routing inside HandleMessages still picks the
// stream path when req.Stream=true and that the basic SSE shape is
// emitted on success. Guards against accidental regressions where a
// refactor sends streaming requests down the JSON path.
func TestSSE_HappyPath_EmitsEvents(t *testing.T) {
	mux := http.NewServeMux()
	mux.Handle("POST /v1/messages",
		HandleMessages(fakeProvider{configured: true, out: "hi"}, nil, nil, nil))

	body, _ := json.Marshal(MessagesRequest{
		Model: "claude-haiku-4-5", MaxTokens: 64, Stream: true,
		Messages: []Message{{Role: "user", Content: "ping"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	req = req.WithContext(context.Background())
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	out := rec.Body.String()
	for _, want := range []string{"message_start", "content_block_delta", "message_stop"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing SSE event %q in output", want)
		}
	}
}
