package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/storage"
)

func TestHandleV1Messages(t *testing.T) {
	tests := []struct {
		name   string
		body   interface{}
		auth   bool
		summ   fakeSummarizer
		audit  storage.AuditRepository
		expect int
	}{
		{"missing auth", AnthropicMessagesRequest{
			Model: "claude-haiku", MaxTokens: 256,
			Messages: []AnthropicMessage{{Role: "user", Content: "hi"}},
		}, false, fakeSummarizer{configured: true, summary: "ok"},
			storage.NewInMemoryAuditRepo(), http.StatusUnauthorized},
		{"empty messages", AnthropicMessagesRequest{
			Model: "claude-haiku", MaxTokens: 256,
		}, true, fakeSummarizer{configured: true},
			storage.NewInMemoryAuditRepo(), http.StatusBadRequest},
		{"unconfigured AI", AnthropicMessagesRequest{
			Model: "claude-haiku", MaxTokens: 256,
			Messages: []AnthropicMessage{{Role: "user", Content: "hi"}},
		}, true, fakeSummarizer{configured: false},
			storage.NewInMemoryAuditRepo(), http.StatusServiceUnavailable},
		{"happy path", AnthropicMessagesRequest{
			Model: "claude-haiku", MaxTokens: 256,
			System:   "you are an aml assistant",
			Messages: []AnthropicMessage{{Role: "user", Content: "screen smith"}},
		}, true, fakeSummarizer{configured: true, summary: "no match"},
			storage.NewInMemoryAuditRepo(), http.StatusOK},
		{"stream accepted as SSE", AnthropicMessagesRequest{
			Model: "claude-haiku", MaxTokens: 256,
			Stream:   true,
			Messages: []AnthropicMessage{{Role: "user", Content: "hi"}},
		}, true, fakeSummarizer{configured: true, summary: "x"},
			storage.NewInMemoryAuditRepo(), http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest("POST", "/v1/messages",
				bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			if tt.auth {
				req = req.WithContext(ContextWithClaims(req.Context(),
					&Claims{TenantID: "tnt_abc123def456", UserID: "u"}))
			}
			rec := httptest.NewRecorder()
			handleV1Messages(aiHandlerDeps{client: tt.summ, audit: tt.audit})(rec, req)
			if rec.Code != tt.expect {
				t.Fatalf("status: want %d got %d body=%s",
					tt.expect, rec.Code, rec.Body.String())
			}
		})
	}
}

// TestV1Messages_ResponseShape locks in the wire shape clients expect.
// Drop-in compatibility means these field names cannot drift.
func TestV1Messages_ResponseShape(t *testing.T) {
	body, _ := json.Marshal(AnthropicMessagesRequest{
		Model: "claude-haiku-4-5", MaxTokens: 256,
		Messages: []AnthropicMessage{{Role: "user", Content: "hi"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(ContextWithClaims(req.Context(),
		&Claims{TenantID: "tnt_abc123def456", UserID: "u"}))
	rec := httptest.NewRecorder()
	handleV1Messages(aiHandlerDeps{
		client: fakeSummarizer{configured: true, summary: "screened: clean"},
		audit:  storage.NewInMemoryAuditRepo(),
	})(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 got %d: %s", rec.Code, rec.Body.String())
	}
	for _, sub := range []string{
		`"type":"message"`, `"role":"assistant"`, `"content"`,
		`"input_tokens"`, `"output_tokens"`, `"stop_reason"`,
	} {
		if !strings.Contains(rec.Body.String(), sub) {
			t.Errorf("response missing %q: %s", sub, rec.Body.String())
		}
	}
}
