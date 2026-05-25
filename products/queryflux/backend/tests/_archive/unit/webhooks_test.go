package lemonsqueezy

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
)

func TestWebhookHandler_ParseWebhook(t *testing.T) {
	logger := zaptest.NewLogger(t)
	config := &Config{
		WebhookSecret: "test_secret",
	}
	client := NewClient(config, logger)
	handler := NewWebhookHandler(client, logger)

	// Test data
	event := &WebhookEvent{
		Meta: struct {
			EventName      string                 `json:"event_name"`
			EventID        string                 `json:"event_id"`
			CustomData     map[string]interface{} `json:"custom_data,omitempty"`
		}{
			EventName: "subscription_created",
			EventID:   uuid.New().String(),
		},
		Data: WebhookData{
			ID:   uuid.New().String(),
			Type: "subscriptions",
		},
	}

	// Marshal event
	eventBytes, err := json.Marshal(event)
	require.NoError(t, err)

	// Create signature
	timestamp := time.Now().Format(time.RFC3339)
	signedPayload := timestamp + "." + string(eventBytes)
	mac := hmac.New(sha256.New, []byte(config.WebhookSecret))
	mac.Write([]byte(signedPayload))
	signature := "t=" + timestamp + ",v1=" + hex.EncodeToString(mac.Sum(nil))

	// Create request
	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(eventBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", signature)

	// Parse webhook
	parsedEvent, err := handler.ParseWebhook(req)
	require.NoError(t, err)
	assert.Equal(t, event.Meta.EventName, parsedEvent.Meta.EventName)
	assert.Equal(t, event.Meta.EventID, parsedEvent.Meta.EventID)
}

func TestWebhookHandler_ParseWebhook_InvalidSignature(t *testing.T) {
	logger := zaptest.NewLogger(t)
	config := &Config{
		WebhookSecret: "test_secret",
	}
	client := NewClient(config, logger)
	handler := NewWebhookHandler(client, logger)

	// Test data
	event := &WebhookEvent{
		Meta: struct {
			EventName      string                 `json:"event_name"`
			EventID        string                 `json:"event_id"`
			CustomData     map[string]interface{} `json:"custom_data,omitempty"`
		}{
			EventName: "subscription_created",
			EventID:   uuid.New().String(),
		},
	}

	// Marshal event
	eventBytes, err := json.Marshal(event)
	require.NoError(t, err)

	// Create request with invalid signature
	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(eventBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", "invalid_signature")

	// Parse webhook
	_, err = handler.ParseWebhook(req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid webhook signature")
}

func TestWebhookHandler_ParseWebhook_MissingSignature(t *testing.T) {
	logger := zaptest.NewLogger(t)
	config := &Config{
		WebhookSecret: "test_secret",
	}
	client := NewClient(config, logger)
	handler := NewWebhookHandler(client, logger)

	// Test data
	event := &WebhookEvent{
		Meta: struct {
			EventName      string                 `json:"event_name"`
			EventID        string                 `json:"event_id"`
			CustomData     map[string]interface{} `json:"custom_data,omitempty"`
		}{
			EventName: "subscription_created",
			EventID:   uuid.New().String(),
		},
	}

	// Marshal event
	eventBytes, err := json.Marshal(event)
	require.NoError(t, err)

	// Create request without signature
	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(eventBytes))
	req.Header.Set("Content-Type", "application/json")

	// Parse webhook
	_, err = handler.ParseWebhook(req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "missing signature header")
}

func TestWebhookHandler_HandleEvent_OrderCreated(t *testing.T) {
	logger := zaptest.NewLogger(t)
	config := &Config{
		WebhookSecret: "test_secret",
	}
	client := NewClient(config, logger)
	handler := NewWebhookHandler(client, logger)

	// Test data
	event := &WebhookEvent{
		Meta: struct {
			EventName      string                 `json:"event_name"`
			EventID        string                 `json:"event_id"`
			CustomData     map[string]interface{} `json:"custom_data,omitempty"`
		}{
			EventName: EventOrderCreated,
			EventID:   uuid.New().String(),
		},
		Data: WebhookData{
			ID:   uuid.New().String(),
			Type: "orders",
			Attributes: json.RawMessage(`{
				"store_id": 1,
				"customer_id": 1,
				"order_id": 123,
				"product_id": 456,
				"variant_id": 789,
				"identifier": "ORD-123",
				"currency": "USD",
				"total": 29.00,
				"subtotal": 29.00,
				"discount_total": 0.00,
				"tax_total": 0.00,
				"status": "paid",
				"email": "test@example.com",
				"name": "Test User",
				"billing_address": {
					"country": "US",
					"zip": "12345"
				},
				"test_mode": true,
				"created_at": "2024-01-01T00:00:00Z",
				"updated_at": "2024-01-01T00:00:00Z"
			}`),
		},
	}

	// Handle event
	err := handler.HandleEvent(event)
	assert.NoError(t, err)
}

func TestWebhookHandler_HandleEvent_SubscriptionCreated(t *testing.T) {
	logger := zaptest.NewLogger(t)
	config := &Config{
		WebhookSecret: "test_secret",
	}
	client := NewClient(config, logger)
	handler := NewWebhookHandler(client, logger)

	// Test data
	event := &WebhookEvent{
		Meta: struct {
			EventName      string                 `json:"event_name"`
			EventID        string                 `json:"event_id"`
			CustomData     map[string]interface{} `json:"custom_data,omitempty"`
		}{
			EventName: EventSubscriptionCreated,
			EventID:   uuid.New().String(),
		},
		Data: WebhookData{
			ID:   uuid.New().String(),
			Type: "subscriptions",
			Attributes: json.RawMessage(`{
				"customer_id": 1,
				"order_id": 123,
				"product_id": 456,
				"variant_id": 789,
				"status": "on_trial",
				"trial_ends_at": "2024-02-01T00:00:00Z",
				"renews_at": "2024-02-01T00:00:00Z",
				"created_at": "2024-01-01T00:00:00Z",
				"updated_at": "2024-01-01T00:00:00Z",
				"test_mode": true
			}`),
		},
	}

	// Handle event
	err := handler.HandleEvent(event)
	assert.NoError(t, err)
}

func TestWebhookHandler_HandleEvent_SubscriptionCancelled(t *testing.T) {
	logger := zaptest.NewLogger(t)
	config := &Config{
		WebhookSecret: "test_secret",
	}
	client := NewClient(config, logger)
	handler := NewWebhookHandler(client, logger)

	// Test data
	event := &WebhookEvent{
		Meta: struct {
			EventName      string                 `json:"event_name"`
			EventID        string                 `json:"event_id"`
			CustomData     map[string]interface{} `json:"custom_data,omitempty"`
		}{
			EventName: EventSubscriptionCancelled,
			EventID:   uuid.New().String(),
		},
		Data: WebhookData{
			ID:   uuid.New().String(),
			Type: "subscriptions",
			Attributes: json.RawMessage(`{
				"customer_id": 1,
				"order_id": 123,
				"product_id": 456,
				"variant_id": 789,
				"status": "cancelled",
				"trial_ends_at": null,
				"renews_at": null,
				"ends_at": "2024-02-01T00:00:00Z",
				"created_at": "2024-01-01T00:00:00Z",
				"updated_at": "2024-01-15T00:00:00Z",
				"test_mode": true
			}`),
		},
	}

	// Handle event
	err := handler.HandleEvent(event)
	assert.NoError(t, err)
}

func TestWebhookHandler_HandleEvent_UnknownEvent(t *testing.T) {
	logger := zaptest.NewLogger(t)
	config := &Config{
		WebhookSecret: "test_secret",
	}
	client := NewClient(config, logger)
	handler := NewWebhookHandler(client, logger)

	// Test data with unknown event
	event := &WebhookEvent{
		Meta: struct {
			EventName      string                 `json:"event_name"`
			EventID        string                 `json:"event_id"`
			CustomData     map[string]interface{} `json:"custom_data,omitempty"`
		}{
			EventName: "unknown_event",
			EventID:   uuid.New().String(),
		},
		Data: WebhookData{
			ID:         uuid.New().String(),
			Type:       "test",
			Attributes: json.RawMessage(`{}`),
		},
	}

	// Handle event - should not return error
	err := handler.HandleEvent(event)
	assert.NoError(t, err)
}

func TestWebhookHandler_verifySignature(t *testing.T) {
	logger := zaptest.NewLogger(t)
	config := &Config{
		WebhookSecret: "test_secret",
	}
	client := NewClient(config, logger)
	handler := NewWebhookHandler(client, logger)

	// Test data
	payload := "test_payload"
	timestamp := time.Now().Format(time.RFC3339)

	// Create valid signature
	signedPayload := timestamp + "." + payload
	mac := hmac.New(sha256.New, []byte(config.WebhookSecret))
	mac.Write([]byte(signedPayload))
	validSignature := "t=" + timestamp + ",v1=" + hex.EncodeToString(mac.Sum(nil))

	// Test valid signature
	err := handler.verifySignature([]byte(payload), validSignature)
	assert.NoError(t, err)

	// Test invalid signature
	invalidSignature := "t=" + timestamp + ",v1=invalid_hash"
	err = handler.verifySignature([]byte(payload), invalidSignature)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "hash mismatch")

	// Test old timestamp
	oldTimestamp := time.Now().Add(-10 * time.Minute).Format(time.RFC3339)
	signedPayload = oldTimestamp + "." + payload
	mac = hmac.New(sha256.New, []byte(config.WebhookSecret))
	mac.Write([]byte(signedPayload))
	oldSignature := "t=" + oldTimestamp + ",v1=" + hex.EncodeToString(mac.Sum(nil))

	err = handler.verifySignature([]byte(payload), oldSignature)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "webhook timestamp too old")

	// Test missing parts
	incompleteSignature := "v1=hash"
	err = handler.verifySignature([]byte(payload), incompleteSignature)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid signature format")
}

func TestMapLemonSqueezyStatusToInternal(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"on_trial", entities.SubscriptionStatusOnTrial},
		{"active", entities.SubscriptionStatusActive},
		{"cancelled", entities.SubscriptionStatusCancelled},
		{"expired", entities.SubscriptionStatusExpired},
		{"unpaid", entities.SubscriptionStatusUnpaid},
		{"paused", entities.SubscriptionStatusPaused},
		{"unknown_status", entities.SubscriptionStatusExpired},
	}

	for _, test := range tests {
		result := MapLemonSqueezyStatusToInternal(test.input)
		assert.Equal(t, test.expected, result, "Input: %s", test.input)
	}
}