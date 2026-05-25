package domain

import (
	"fmt"
	"net/url"
	"time"
)

// WebhookEndpoint is a registered callback URL for a tenant.
type WebhookEndpoint struct {
	ID        string
	TenantID  TenantID
	URL       string
	Secret    string
	Events    []WebhookEventType
	Active    bool
	CreatedAt time.Time
}

func NewWebhookEndpoint(
	tenantID TenantID, rawURL, secret string, events []WebhookEventType,
) (WebhookEndpoint, error) {
	if tenantID.IsZero() || rawURL == "" {
		return WebhookEndpoint{}, fmt.Errorf("tenant and url required")
	}
	if _, err := url.ParseRequestURI(rawURL); err != nil {
		return WebhookEndpoint{}, fmt.Errorf("invalid url: %w", err)
	}
	if len(events) == 0 {
		return WebhookEndpoint{}, fmt.Errorf("at least one event required")
	}
	return WebhookEndpoint{
		ID:        fmt.Sprintf("whep_%d", time.Now().UnixNano()),
		TenantID:  tenantID,
		URL:       rawURL,
		Secret:    secret,
		Events:    events,
		Active:    true,
		CreatedAt: time.Now().UTC(),
	}, nil
}

// SubscribedTo checks if endpoint listens for a given event type.
func (we WebhookEndpoint) SubscribedTo(eventType WebhookEventType) bool {
	for _, e := range we.Events {
		if e == eventType {
			return true
		}
	}
	return false
}
