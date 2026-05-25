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

// fakeProvider satisfies sdlc-core's ai.Provider interface for tests
// without needing real Anthropic credentials.
type fakeProvider struct {
	configured bool
	out        string
}

func (f fakeProvider) IsConfigured() bool { return f.configured }
func (f fakeProvider) Name() string       { return "fake" }
func (f fakeProvider) Complete(_ context.Context, _ string) (string, error) {
	return f.out, nil
}

func TestHandleMessages_HappyPath(t *testing.T) {
	body, _ := json.Marshal(MessagesRequest{
		Model: "claude-haiku", MaxTokens: 64,
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	HandleMessages(fakeProvider{configured: true, out: "hello"}, nil, nil, nil)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d body=%s", rec.Code, rec.Body.String())
	}
	for _, sub := range []string{
		`"type":"message"`, `"role":"assistant"`, `"content"`,
		`"input_tokens"`, `"output_tokens"`, `"text":"hello"`,
	} {
		if !strings.Contains(rec.Body.String(), sub) {
			t.Errorf("missing %q in body: %s", sub, rec.Body.String())
		}
	}
}

func TestHandleMessages_DLPScrubsPAN(t *testing.T) {
	body, _ := json.Marshal(MessagesRequest{
		Model: "claude-haiku", MaxTokens: 64,
		Messages: []Message{{Role: "user", Content: "card 4111-1111-1111-1111"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleMessages(fakeProvider{
		configured: true,
		out:        "your card 4111-1111-1111-1111 was charged",
	}, nil, nil, nil)(rec, req)
	if strings.Contains(rec.Body.String(), "4111-1111-1111-1111") {
		t.Errorf("PAN leaked: %s", rec.Body.String())
	}
}

func TestHandleMessages_Unconfigured(t *testing.T) {
	body, _ := json.Marshal(MessagesRequest{
		Model: "x", MaxTokens: 64,
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleMessages(fakeProvider{configured: false}, nil, nil, nil)(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("got %d want 503", rec.Code)
	}
}

func TestHandleMessagesStream_EventSequence(t *testing.T) {
	body, _ := json.Marshal(MessagesRequest{
		Model: "claude-haiku", MaxTokens: 64, Stream: true,
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleMessagesStream(fakeProvider{
		configured: true, out: "streamed answer",
	})(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d body=%s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("wrong Content-Type: %q", rec.Header().Get("Content-Type"))
	}
	for _, ev := range []string{
		"event: message_start", "event: content_block_start",
		"event: content_block_delta", "event: content_block_stop",
		"event: message_stop",
	} {
		if !strings.Contains(rec.Body.String(), ev) {
			t.Errorf("missing %q", ev)
		}
	}
}
