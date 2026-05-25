package domain

import (
	"fmt"
	"time"
)

// WebhookEvent types for compliance notifications.
type WebhookEventType string

const (
	WebhookCaseCreated   WebhookEventType = "case.created"
	WebhookCaseAssigned  WebhookEventType = "case.assigned"
	WebhookCaseEscalated WebhookEventType = "case.escalated"
	WebhookCaseResolved  WebhookEventType = "case.resolved"
	WebhookAlertCreated  WebhookEventType = "alert.created"
	WebhookTxnAlert      WebhookEventType = "txn_alert.created"
	WebhookMonitorMatch  WebhookEventType = "monitor.match_found"
	WebhookEDDCompleted  WebhookEventType = "edd.completed"
	WebhookListUpdated   WebhookEventType = "list.updated"
)

// WebhookPayload is sent to registered endpoints.
type WebhookPayload struct {
	ID        string           `json:"id"`
	EventType WebhookEventType `json:"event_type"`
	TenantID  string           `json:"tenant_id"`
	Data      interface{}      `json:"data"`
	CreatedAt time.Time        `json:"created_at"`
}

func NewWebhookPayload(
	eventType WebhookEventType, tenantID string, data interface{},
) WebhookPayload {
	return WebhookPayload{
		ID:        fmt.Sprintf("whk_%d", time.Now().UnixNano()),
		EventType: eventType,
		TenantID:  tenantID,
		Data:      data,
		CreatedAt: time.Now().UTC(),
	}
}
