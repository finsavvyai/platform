package billing

import (
	"bytes"
	"encoding/json"
	"testing"
)

type mockHandler struct {
	calls map[string]int
}

func (m *mockHandler) HandleSubscriptionCreated(event WebhookEvent) error {
	m.calls["created"]++
	return nil
}

func (m *mockHandler) HandleSubscriptionUpdated(event WebhookEvent) error {
	m.calls["updated"]++
	return nil
}

func (m *mockHandler) HandleSubscriptionPaymentSuccess(event WebhookEvent) error {
	m.calls["payment_success"]++
	return nil
}

func (m *mockHandler) HandleSubscriptionPaymentFailed(event WebhookEvent) error {
	m.calls["payment_failed"]++
	return nil
}

func (m *mockHandler) HandleSubscriptionCancelled(event WebhookEvent) error {
	m.calls["cancelled"]++
	return nil
}

func (m *mockHandler) HandleOrderCreated(event WebhookEvent) error {
	m.calls["order_created"]++
	return nil
}

func TestParseWebhookEvent(t *testing.T) {
	payload := map[string]interface{}{
		"type": "subscription_created",
		"data": map[string]interface{}{
			"id": "sub_123",
		},
	}
	data, _ := json.Marshal(payload)
	body := bytes.NewReader(data)

	event, err := ParseWebhookEvent(body)
	if err != nil {
		t.Fatalf("ParseWebhookEvent() error = %v", err)
	}
	if event.Type != "subscription_created" {
		t.Errorf("Type = %s, want subscription_created", event.Type)
	}
}

func TestHandleWebhookEvent(t *testing.T) {
	event := WebhookEvent{
		Type: "subscription_created",
		Data: map[string]interface{}{},
	}

	handler := &mockHandler{calls: make(map[string]int)}
	err := HandleWebhookEvent(event, handler)
	if err != nil {
		t.Errorf("HandleWebhookEvent() error = %v", err)
	}
	if handler.calls["created"] != 1 {
		t.Error("handler not called")
	}
}

func TestHandleWebhookEventUnknown(t *testing.T) {
	event := WebhookEvent{
		Type: "unknown_event",
		Data: map[string]interface{}{},
	}

	handler := &mockHandler{calls: make(map[string]int)}
	err := HandleWebhookEvent(event, handler)
	if err == nil {
		t.Error("HandleWebhookEvent() should fail for unknown type")
	}
}
