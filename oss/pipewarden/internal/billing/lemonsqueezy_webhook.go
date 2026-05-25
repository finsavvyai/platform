package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// WebhookEvent represents a LemonSqueezy webhook event.
type WebhookEvent struct {
	Meta  EventMeta              `json:"meta"`
	Data  EventData              `json:"data"`
	Meta2 map[string]interface{} `json:"meta2,omitempty"`
}

// EventMeta contains webhook metadata.
type EventMeta struct {
	EventName  string      `json:"event_name"`
	CustomData interface{} `json:"custom_data"`
}

// EventData contains the actual subscription data from webhook.
type EventData struct {
	Attributes SubscriptionAttrs `json:"attributes"`
}

// SubscriptionAttrs holds subscription attributes from webhook.
type SubscriptionAttrs struct {
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	RenewsAt  time.Time `json:"renews_at"`
}

// WebhookHandler processes incoming LemonSqueezy webhook events.
func (c *Client) WebhookHandler(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("invalid HTTP method: %s", r.Method)
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return fmt.Errorf("failed to read request body: %w", err)
	}
	defer func() { _ = r.Body.Close() }()

	signature := r.Header.Get("X-Signature")
	if !c.VerifyWebhookSignature(body, signature) {
		return fmt.Errorf("invalid webhook signature")
	}

	event, err := c.ParseWebhookEvent(body)
	if err != nil {
		return err
	}

	switch event.Meta.EventName {
	case "subscription_created":
		return c.handleSubscriptionCreated(event)
	case "subscription_updated":
		return c.handleSubscriptionUpdated(event)
	case "subscription_cancelled":
		return c.handleSubscriptionCancelled(event)
	default:
		return fmt.Errorf("unknown event type: %s", event.Meta.EventName)
	}
}

func (c *Client) handleSubscriptionCreated(event *WebhookEvent) error {
	return nil
}

func (c *Client) handleSubscriptionUpdated(event *WebhookEvent) error {
	return nil
}

func (c *Client) handleSubscriptionCancelled(event *WebhookEvent) error {
	return nil
}

// VerifyWebhookSignature validates the webhook using HMAC-SHA256.
func (c *Client) VerifyWebhookSignature(body []byte, signature string) bool {
	if c.config.WebhookKey == "" {
		return false
	}

	hash := hmac.New(sha256.New, []byte(c.config.WebhookKey))
	hash.Write(body)
	expected := "sha256=" + hex.EncodeToString(hash.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expected))
}

// ParseWebhookEvent decodes a LemonSqueezy webhook payload.
func (c *Client) ParseWebhookEvent(body []byte) (*WebhookEvent, error) {
	var event WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return nil, fmt.Errorf("failed to unmarshal webhook: %w", err)
	}
	return &event, nil
}
