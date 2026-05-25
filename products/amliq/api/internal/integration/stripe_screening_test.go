package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/screening"
)

func TestStripeScreeningMiddleware(t *testing.T) {
	engine := screening.NewFastEngine()
	middleware := NewStripeScreeningMiddleware(engine)

	tests := []struct {
		name       string
		eventType  string
		wantStatus int
	}{
		{"payment_intent", "payment_intent.created", http.StatusOK},
		{"other_event", "charge.succeeded", http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			event := map[string]interface{}{
				"type": tt.eventType,
				"data": map[string]interface{}{
					"object": map[string]interface{}{
						"id":       "pi_test123",
						"amount":   50000,
						"metadata": map[string]string{"originator_name": "John Doe"},
					},
				},
			}
			body, _ := json.Marshal(event)
			req := httptest.NewRequest("POST", "/webhooks/stripe", bytes.NewReader(body))
			w := httptest.NewRecorder()

			middleware.HandleWebhook(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}
