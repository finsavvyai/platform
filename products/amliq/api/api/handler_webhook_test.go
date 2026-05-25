package api

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/billing"
)

func TestWebhookHandleSignatureValidation(t *testing.T) {
	svc := billing.NewBillingService(nil, nil, nil, nil, nil)
	handler := NewWebhookHandler(svc)

	tests := []struct {
		name       string
		signature  string
		body       string
		wantStatus int
	}{
		{"missing signature", "", `{}`, http.StatusUnauthorized},
		{"invalid signature", "invalid", `{}`, http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/webhooks/lemonsqueezy",
				bytes.NewBufferString(tt.body))
			if tt.signature != "" {
				req.Header.Set("X-Signature", tt.signature)
			}
			w := httptest.NewRecorder()
			handler.Handle(w, req)
			if w.Code != tt.wantStatus {
				t.Errorf("Status=%d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

func testHMACSig(payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}
