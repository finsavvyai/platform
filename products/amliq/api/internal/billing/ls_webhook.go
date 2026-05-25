package billing

import (
	"encoding/json"
	"fmt"
	"io"
)

type WebhookEvent struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
}

type WebhookHandler interface {
	HandleSubscriptionCreated(event WebhookEvent) error
	HandleSubscriptionUpdated(event WebhookEvent) error
	HandleSubscriptionPaymentSuccess(event WebhookEvent) error
	HandleSubscriptionPaymentFailed(event WebhookEvent) error
	HandleSubscriptionCancelled(event WebhookEvent) error
	HandleOrderCreated(event WebhookEvent) error
}

func ParseWebhookEvent(body io.Reader) (WebhookEvent, error) {
	var event WebhookEvent
	decoder := json.NewDecoder(body)
	if err := decoder.Decode(&event); err != nil {
		return WebhookEvent{}, err
	}
	if event.Type == "" {
		return WebhookEvent{}, fmt.Errorf("webhook event type required")
	}
	return event, nil
}

func HandleWebhookEvent(event WebhookEvent, handler WebhookHandler) error {
	switch event.Type {
	case "subscription_created":
		return handler.HandleSubscriptionCreated(event)
	case "subscription_updated":
		return handler.HandleSubscriptionUpdated(event)
	case "subscription_payment_success":
		return handler.HandleSubscriptionPaymentSuccess(event)
	case "subscription_payment_failed":
		return handler.HandleSubscriptionPaymentFailed(event)
	case "subscription_cancelled":
		return handler.HandleSubscriptionCancelled(event)
	case "order_created":
		return handler.HandleOrderCreated(event)
	default:
		return fmt.Errorf("unknown event type: %s", event.Type)
	}
}

func ExtractTenantID(event WebhookEvent) (string, error) {
	data, ok := event.Data["attributes"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("attributes not found in event data")
	}
	metadata, ok := data["meta"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("meta not found")
	}
	tenantID, ok := metadata["tenant_id"].(string)
	if !ok {
		return "", fmt.Errorf("tenant_id not found")
	}
	return tenantID, nil
}
