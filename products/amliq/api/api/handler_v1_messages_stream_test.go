package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/storage"
)

// TestStreamingSSE_EventSequence locks in the wire format Claude
// Code's SSE parser expects: message_start → content_block_start →
// content_block_delta → content_block_stop → message_stop. Drift in
// any event name or order breaks the client.
func TestStreamingSSE_EventSequence(t *testing.T) {
	body, _ := json.Marshal(AnthropicMessagesRequest{
		Model: "claude-haiku", MaxTokens: 64, Stream: true,
		Messages: []AnthropicMessage{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(ContextWithClaims(context.Background(),
		&Claims{TenantID: "tnt_abc123def456", UserID: "u"}))
	rec := httptest.NewRecorder()
	handleV1Messages(aiHandlerDeps{
		client: fakeSummarizer{configured: true, summary: "clean response"},
		audit:  storage.NewInMemoryAuditRepo(),
	})(rec, req)
	out := rec.Body.String()
	if rec.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("expected SSE Content-Type, got %q",
			rec.Header().Get("Content-Type"))
	}
	for i, ev := range []string{
		"event: message_start",
		"event: content_block_start",
		"event: content_block_delta",
		"event: content_block_stop",
		"event: message_stop",
	} {
		if !strings.Contains(out, ev) {
			t.Errorf("event %d missing %q in output", i, ev)
		}
	}
}

// TestStreamingSSE_DLPScrubbed verifies the buffer-then-scrub
// guarantee: a PAN/IBAN in the provider's response gets MaskAML'd
// BEFORE being emitted as the content_block_delta. This is the
// compliance-correctness invariant — if it ever breaks, sdlc.cc's
// whole pitch ('we DLP everything') is a lie.
func TestStreamingSSE_DLPScrubbed(t *testing.T) {
	body, _ := json.Marshal(AnthropicMessagesRequest{
		Model: "claude-haiku", MaxTokens: 64, Stream: true,
		Messages: []AnthropicMessage{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(ContextWithClaims(context.Background(),
		&Claims{TenantID: "tnt_abc123def456", UserID: "u"}))
	rec := httptest.NewRecorder()
	// Provider returns a (real-looking) PAN. The scrub must redact it.
	handleV1Messages(aiHandlerDeps{
		client: fakeSummarizer{configured: true,
			summary: "card 4111-1111-1111-1111 was used"},
		audit: storage.NewInMemoryAuditRepo(),
	})(rec, req)
	out := rec.Body.String()
	if strings.Contains(out, "4111-1111-1111-1111") {
		t.Errorf("PAN leaked through stream — output: %s", out)
	}
	if !strings.Contains(out, "1111") {
		t.Error("expected last-4 to survive scrub for audit utility")
	}
}

// TestStreamingSSE_UnconfiguredAI returns the same 503 the non-
// stream path does. Doesn't try to stream anything.
func TestStreamingSSE_UnconfiguredAI(t *testing.T) {
	body, _ := json.Marshal(AnthropicMessagesRequest{
		Model: "claude-haiku", MaxTokens: 64, Stream: true,
		Messages: []AnthropicMessage{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(ContextWithClaims(context.Background(),
		&Claims{TenantID: "tnt_abc123def456", UserID: "u"}))
	rec := httptest.NewRecorder()
	handleV1Messages(aiHandlerDeps{
		client: fakeSummarizer{configured: false},
		audit:  storage.NewInMemoryAuditRepo(),
	})(rec, req)
	if rec.Code != 503 {
		t.Errorf("expected 503 on unconfigured AI even in stream mode, got %d",
			rec.Code)
	}
}
