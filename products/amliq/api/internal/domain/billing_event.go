package domain

import (
	"encoding/json"
	"fmt"
	"time"
)

type BillingEventType string

const (
	EventSubscriptionCreated   BillingEventType = "subscription_created"
	EventSubscriptionUpdated   BillingEventType = "subscription_updated"
	EventSubscriptionCancelled BillingEventType = "subscription_cancelled"
	EventPaymentSuccess        BillingEventType = "payment_success"
	EventPaymentFailed         BillingEventType = "payment_failed"
	EventUsageLimitReached     BillingEventType = "usage_limit_reached"
	EventOrderCreated          BillingEventType = "order_created"
)

type BillingEvent struct {
	ID        string
	Type      BillingEventType
	TenantID  TenantID
	Payload   json.RawMessage
	CreatedAt time.Time
}

func NewBillingEvent(eventType BillingEventType, tenantID TenantID, payload interface{}) (BillingEvent, error) {
	if !isValidEventType(eventType) || tenantID.IsZero() {
		return BillingEvent{}, fmt.Errorf("invalid event type or tenant")
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return BillingEvent{}, err
	}
	return BillingEvent{
		ID:        fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		Type:      eventType,
		TenantID:  tenantID,
		Payload:   payloadJSON,
		CreatedAt: time.Now().UTC(),
	}, nil
}

func isValidEventType(t BillingEventType) bool {
	switch t {
	case EventSubscriptionCreated, EventSubscriptionUpdated, EventSubscriptionCancelled,
		EventPaymentSuccess, EventPaymentFailed, EventUsageLimitReached, EventOrderCreated:
		return true
	default:
		return false
	}
}

func (e BillingEvent) String() string {
	return fmt.Sprintf("BillingEvent(%s, type=%s, tenant=%s)", e.ID, e.Type, e.TenantID)
}
