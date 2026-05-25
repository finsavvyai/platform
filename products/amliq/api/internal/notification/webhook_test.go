package notification

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWebhookSenderSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Type") != "application/json" {
			t.Error("expected Content-Type: application/json")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	sender := NewWebhookSender()
	payload := WebhookPayload{
		Event:      "monitoring.status_change",
		MonitorID:  "mon_123",
		EntityName: "John Smith",
		NewStatus:  "MATCH",
		Confidence: 0.87,
		Timestamp:  "2026-04-03T10:00:00Z",
	}

	err := sender.Send(context.Background(), server.URL, payload)
	if err != nil {
		t.Fatalf("Send error: %v", err)
	}
}

func TestWebhookSenderRetry(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	sender := NewWebhookSender()
	sender.delays = []time.Duration{0, 0, 0} // no delay in tests
	payload := WebhookPayload{Event: "test", MonitorID: "mon_1"}

	err := sender.Send(context.Background(), server.URL, payload)
	if err != nil {
		t.Fatalf("Send should succeed after retries: %v", err)
	}
	if attempts != 3 {
		t.Errorf("expected 3 attempts, got %d", attempts)
	}
}
