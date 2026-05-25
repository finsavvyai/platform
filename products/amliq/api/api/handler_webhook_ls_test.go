package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/billing"
)

func TestWebhookHandler(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		signature  string
		body       string
		wantStatus int
	}{
		{
			"rejects GET",
			http.MethodGet,
			"",
			"",
			http.StatusMethodNotAllowed,
		},
		{
			"rejects missing signature",
			http.MethodPost,
			"",
			`{"type":"subscription_created"}`,
			http.StatusUnauthorized,
		},
		{
			"rejects invalid signature",
			http.MethodPost,
			"invalid_sig",
			`{"type":"subscription_created"}`,
			http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := billing.NewBillingService(nil, nil, nil, nil, nil)
			handler := NewWebhookHandler(svc)

			req := httptest.NewRequest(tt.method, "/webhooks/lemonsqueezy",
				strings.NewReader(tt.body))
			if tt.signature != "" {
				req.Header.Set("X-Signature", tt.signature)
			}
			rr := httptest.NewRecorder()
			handler.Handle(rr, req)

			if rr.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
