package domain

import (
	"encoding/json"
	"testing"
)

func testTenantID(t *testing.T) TenantID {
	t.Helper()
	tid, err := NewTenantID("tnt_aabbccddeeff")
	if err != nil {
		t.Fatalf("NewTenantID() error = %v", err)
	}
	return tid
}

func TestNewBillingEvent(t *testing.T) {
	tenantID := testTenantID(t)
	payload := map[string]string{"subscription_id": "sub_456"}

	evt, err := NewBillingEvent(EventSubscriptionCreated, tenantID, payload)
	if err != nil {
		t.Fatalf("NewBillingEvent() error = %v", err)
	}
	if evt.Type != EventSubscriptionCreated {
		t.Errorf("Type = %v, want %v", evt.Type, EventSubscriptionCreated)
	}
	if evt.TenantID != tenantID {
		t.Errorf("TenantID = %v, want %v", evt.TenantID, tenantID)
	}
	if len(evt.Payload) == 0 {
		t.Errorf("Payload is empty")
	}
}

func TestNewBillingEventValidation(t *testing.T) {
	validTID := testTenantID(t)
	payload := map[string]string{"key": "value"}
	tests := []struct {
		name      string
		eventType BillingEventType
		tenantID  TenantID
		wantErr   bool
	}{
		{"valid", EventSubscriptionCreated, validTID, false},
		{"invalid type", BillingEventType("invalid"), validTID, true},
		{"no tenant", EventSubscriptionCreated, TenantID{}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewBillingEvent(tt.eventType, tt.tenantID, payload)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewBillingEvent() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestBillingEventPayloadUnmarshal(t *testing.T) {
	tenantID := testTenantID(t)
	originalPayload := map[string]interface{}{
		"subscription_id": "sub_456",
		"amount":          50000,
	}

	evt, _ := NewBillingEvent(EventPaymentSuccess, tenantID, originalPayload)

	var decoded map[string]interface{}
	if err := json.Unmarshal(evt.Payload, &decoded); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if decoded["subscription_id"] != "sub_456" {
		t.Errorf("subscription_id = %v, want 'sub_456'", decoded["subscription_id"])
	}
}

func TestBillingEventTypes(t *testing.T) {
	tests := []struct {
		name      string
		eventType BillingEventType
	}{
		{"subscription_created", EventSubscriptionCreated},
		{"subscription_updated", EventSubscriptionUpdated},
		{"subscription_cancelled", EventSubscriptionCancelled},
		{"payment_success", EventPaymentSuccess},
		{"payment_failed", EventPaymentFailed},
		{"usage_limit_reached", EventUsageLimitReached},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.eventType) != tt.name {
				t.Errorf("EventType string = %v, want %v", string(tt.eventType), tt.name)
			}
		})
	}
}
