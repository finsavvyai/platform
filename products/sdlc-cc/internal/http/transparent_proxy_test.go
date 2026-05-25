package http

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIsInterceptedPath(t *testing.T) {
	tests := []struct {
		method, path string
		want         bool
	}{
		{"POST", "/v1/messages", true},
		{"POST", "/v1/messages/count_tokens", false}, // pass-through
		{"GET", "/v1/messages", false},               // wrong method
		{"GET", "/v1/models", false},                 // pass-through
		{"POST", "/v1/embeddings", false},            // pass-through
	}
	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			r := httptest.NewRequest(tt.method, tt.path, nil)
			if got := isInterceptedPath(r); got != tt.want {
				t.Errorf("isInterceptedPath(%s %s)=%v want %v",
					tt.method, tt.path, got, tt.want)
			}
		})
	}
}

// TestHandleAnthropicHostMux_ScrubsToolUseAndForwards is the
// load-bearing case: a Cowork-style request with a PAN inside
// tool_use input must reach the upstream WITHOUT the PAN.
func TestHandleAnthropicHostMux_ScrubsToolUseAndForwards(t *testing.T) {
	var seenBody []byte
	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			seenBody, _ = io.ReadAll(r.Body)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(
				`{"type":"message","role":"assistant",` +
					`"content":[{"type":"text","text":"ack"}]}`))
		}))
	defer upstream.Close()

	client := &http.Client{Transport: &rewriteHostTransport{target: upstream.URL}}
	body := []byte(`{
		"model": "claude-sonnet-4",
		"max_tokens": 1024,
		"messages": [{
			"role": "assistant",
			"content": [{
				"type": "tool_use", "id": "t1", "name": "lookup",
				"input": {"card": "4111-1111-1111-1111"}
			}]
		}]
	}`)
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	req.Header.Set("x-api-key", "sk-customer-key")
	rec := httptest.NewRecorder()
	HandleAnthropicHostMux(
		fakeProvider{configured: true, out: "ignored"},
		client,
	)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s",
			rec.Code, rec.Body.String())
	}
	if strings.Contains(string(seenBody), "4111-1111-1111-1111") {
		t.Errorf("PAN reached upstream — DLP failed: %s", seenBody)
	}
	if !strings.Contains(string(seenBody), "lookup") {
		t.Errorf("structural fields stripped: %s", seenBody)
	}
}

func TestForwardToAnthropic_PassesThrough(t *testing.T) {
	// Stand up a fake "upstream" Anthropic that returns a known body.
	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Custom-Upstream", "set-by-real-anthropic")
			_, _ = w.Write([]byte(`{"data":["model-1","model-2"]}`))
		}))
	defer upstream.Close()

	// Override the upstream URL by routing through the test client
	// to the test server. ForwardToAnthropic builds the request URL
	// from "https://api.anthropic.com" + path, so we use a custom
	// transport that rewrites that host to upstream.URL.
	rt := &rewriteHostTransport{target: upstream.URL}
	client := &http.Client{Transport: rt}

	req := httptest.NewRequest("GET", "/v1/models", nil)
	req.Header.Set("Authorization", "Bearer cust-key")
	rec := httptest.NewRecorder()
	ForwardToAnthropic(client, rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("forward expected 200 got %d body=%s",
			rec.Code, rec.Body.String())
	}
	if rec.Header().Get("X-Custom-Upstream") != "set-by-real-anthropic" {
		t.Errorf("upstream header not preserved: %v", rec.Header())
	}
	if !strings.Contains(rec.Body.String(), "model-1") {
		t.Errorf("upstream body not relayed: %s", rec.Body.String())
	}
}

// rewriteHostTransport is a test-only http.RoundTripper that
// rewrites every outbound URL to point at a test server, so
// ForwardToAnthropic's hardcoded "api.anthropic.com" doesn't
// actually hit the real Anthropic during tests.
type rewriteHostTransport struct {
	target string // full http://127.0.0.1:N base URL
}

func (t *rewriteHostTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	r.URL.Scheme = "http"
	r.URL.Host = strings.TrimPrefix(t.target, "http://")
	r.Host = r.URL.Host
	return http.DefaultTransport.RoundTrip(r)
}

// Suppress unused import on systems where io isn't otherwise needed.
var _ = io.Discard
