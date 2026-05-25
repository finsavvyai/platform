package webhook

import (
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestSignPayload(t *testing.T) {
	tests := []struct {
		name   string
		body   string
		secret string
	}{
		{"basic signature", `{"event":"test"}`, "secret123"},
		{"empty body", "", "key"},
		{"long secret", `{"data":1}`, "a-very-long-secret-key-for-hmac"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sig := signPayload([]byte(tt.body), tt.secret)
			if len(sig) < 10 {
				t.Error("signature too short")
			}
			if sig[:7] != "sha256=" {
				t.Errorf("sig prefix = %s, want sha256=", sig[:7])
			}
			hexPart := sig[7:]
			if _, err := hex.DecodeString(hexPart); err != nil {
				t.Errorf("invalid hex in signature: %v", err)
			}
		})
	}
}

func TestDispatcherSend(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abcdefghijkl")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Aegis-Event") == "" {
			t.Error("missing X-Aegis-Event header")
		}
		if r.Header.Get("X-Aegis-Signature") == "" {
			t.Error("missing X-Aegis-Signature header")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	ep, _ := domain.NewWebhookEndpoint(tid, server.URL, "s3cret",
		[]domain.WebhookEventType{domain.WebhookCaseCreated})
	payload := domain.NewWebhookPayload(domain.WebhookCaseCreated, "tnt_abc", nil)

	d := NewDispatcher(5 * time.Second)
	if err := d.Send(ep, payload); err != nil {
		t.Fatalf("Send error: %v", err)
	}
}

func TestDispatcherSendError(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abcdefghijkl")
	ep, _ := domain.NewWebhookEndpoint(tid, "http://localhost:1", "s",
		[]domain.WebhookEventType{domain.WebhookAlertCreated})
	payload := domain.NewWebhookPayload(domain.WebhookAlertCreated, "t", nil)

	d := NewDispatcher(1 * time.Second)
	err := d.Send(ep, payload)
	if err == nil {
		t.Error("expected error for unreachable endpoint")
	}
}
