package lemonsqueezy

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

// WebhookEvent represents a Lemon Squeezy webhook event
type WebhookEvent struct {
	Meta struct {
		EventName  string                 `json:"event_name"`
		EventID    string                 `json:"event_id"`
		CustomData map[string]interface{} `json:"custom_data,omitempty"`
	} `json:"meta"`
	Data WebhookData `json:"data"`
}

// WebhookData represents webhook event data
type WebhookData struct {
	ID         string          `json:"id"`
	Type       string          `json:"type"`
	Attributes json.RawMessage `json:"attributes"`
}

// OrderCreatedData represents order created event data
type OrderCreatedData struct {
	StoreID        int     `json:"store_id"`
	CustomerID     int     `json:"customer_id"`
	OrderID        int     `json:"order_id"`
	ProductID      int     `json:"product_id"`
	VariantID      int     `json:"variant_id"`
	Identifier     string  `json:"identifier"`
	Currency       string  `json:"currency"`
	Total          float64 `json:"total"`
	Subtotal       float64 `json:"subtotal"`
	DiscountTotal  float64 `json:"discount_total"`
	TaxTotal       float64 `json:"tax_total"`
	Status         string  `json:"status"`
	Email          string  `json:"email"`
	Name           string  `json:"name"`
	BillingAddress struct {
		Country string `json:"country"`
		Zip     string `json:"zip"`
	} `json:"billing_address"`
	TestMode  bool      `json:"test_mode"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SubscriptionCreatedData represents subscription created event data
type SubscriptionCreatedData struct {
	CustomerID  int        `json:"customer_id"`
	OrderID     int        `json:"order_id"`
	ProductID   int        `json:"product_id"`
	VariantID   int        `json:"variant_id"`
	Status      string     `json:"status"`
	TrialEndsAt *time.Time `json:"trial_ends_at"`
	RenewsAt    *time.Time `json:"renews_at"`
	EndsAt      *time.Time `json:"ends_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	TestMode    bool       `json:"test_mode"`
}

// SubscriptionUpdatedData represents subscription updated event data
type SubscriptionUpdatedData struct {
	CustomerID  int        `json:"customer_id"`
	OrderID     int        `json:"order_id"`
	ProductID   int        `json:"product_id"`
	VariantID   int        `json:"variant_id"`
	Status      string     `json:"status"`
	TrialEndsAt *time.Time `json:"trial_ends_at"`
	RenewsAt    *time.Time `json:"renews_at"`
	EndsAt      *time.Time `json:"ends_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	TestMode    bool       `json:"test_mode"`
}

// SubscriptionCancelledData represents subscription cancelled event data
type SubscriptionCancelledData struct {
	CustomerID  int        `json:"customer_id"`
	OrderID     int        `json:"order_id"`
	ProductID   int        `json:"product_id"`
	VariantID   int        `json:"variant_id"`
	Status      string     `json:"status"`
	TrialEndsAt *time.Time `json:"trial_ends_at"`
	RenewsAt    *time.Time `json:"renews_at"`
	EndsAt      *time.Time `json:"ends_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	TestMode    bool       `json:"test_mode"`
}

// Event types
const (
	EventOrderCreated          = "order_created"
	EventSubscriptionCreated   = "subscription_created"
	EventSubscriptionUpdated   = "subscription_updated"
	EventSubscriptionCancelled = "subscription_cancelled"
	EventSubscriptionExpired   = "subscription_expired"
	EventSubscriptionResumed   = "subscription_resumed"
	EventSubscriptionPaused    = "subscription_paused"
	EventPaymentSuccess        = "payment_success"
	EventPaymentFailed         = "payment_failed"
)

// WebhookHandler handles Lemon Squeezy webhook events
type WebhookHandler struct {
	client *Client
	logger *zap.Logger
}

// NewWebhookHandler creates a new webhook handler
func NewWebhookHandler(client *Client, logger *zap.Logger) *WebhookHandler {
	return &WebhookHandler{
		client: client,
		logger: logger,
	}
}

// ParseWebhook parses and validates a webhook event
func (h *WebhookHandler) ParseWebhook(r *http.Request) (*WebhookEvent, error) {
	// Read the body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read webhook body: %w", err)
	}

	// Verify webhook signature
	signature := r.Header.Get("X-Signature")
	if signature == "" {
		return nil, fmt.Errorf("missing signature header")
	}

	if err := h.verifySignature(body, signature); err != nil {
		return nil, fmt.Errorf("invalid webhook signature: %w", err)
	}

	// Parse the event
	var event WebhookEvent
	// if err := parsedResponse.Verify(cert); err != nil {
	// 	return fmt.Errorf("signature verification failed: %w", err)
	// }

	if err := json.Unmarshal(body, &event); err != nil {
		return nil, fmt.Errorf("failed to parse webhook event: %w", err)
	}

	h.logger.Info("Received webhook event",
		zap.String("event_name", event.Meta.EventName),
		zap.String("event_id", event.Meta.EventID),
	)

	return &event, nil
}

// verifySignature verifies the webhook signature
func (h *WebhookHandler) verifySignature(body []byte, signature string) error {
	// Extract the timestamp from the signature
	// Format: t=timestamp,v1=hash
	parts := strings.Split(signature, ",")
	if len(parts) != 2 {
		return fmt.Errorf("invalid signature format")
	}

	var timestamp, hash string
	for _, part := range parts {
		if strings.HasPrefix(part, "t=") {
			timestamp = strings.TrimPrefix(part, "t=")
		} else if strings.HasPrefix(part, "v1=") {
			hash = strings.TrimPrefix(part, "v1=")
		}
	}

	if timestamp == "" || hash == "" {
		return fmt.Errorf("missing timestamp or hash in signature")
	}

	// Check timestamp (prevent replay attacks - webhook should be within 5 minutes)
	ts, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		return fmt.Errorf("invalid timestamp format: %w", err)
	}

	if time.Since(ts) > 5*time.Minute {
		return fmt.Errorf("webhook timestamp too old")
	}

	// Create the signed payload
	signedPayload := fmt.Sprintf("%s.%s", timestamp, string(body))

	// Compute the expected hash
	mac := hmac.New(sha256.New, []byte(h.client.config.WebhookSecret))
	mac.Write([]byte(signedPayload))
	expectedHash := hex.EncodeToString(mac.Sum(nil))

	// Compare hashes
	if hash != expectedHash {
		return fmt.Errorf("hash mismatch")
	}

	return nil
}

// HandleEvent processes a webhook event
func (h *WebhookHandler) HandleEvent(event *WebhookEvent) error {
	switch event.Meta.EventName {
	case EventOrderCreated:
		return h.handleOrderCreated(event)
	case EventSubscriptionCreated:
		return h.handleSubscriptionCreated(event)
	case EventSubscriptionUpdated:
		return h.handleSubscriptionUpdated(event)
	case EventSubscriptionCancelled:
		return h.handleSubscriptionCancelled(event)
	case EventSubscriptionExpired:
		return h.handleSubscriptionExpired(event)
	case EventSubscriptionResumed:
		return h.handleSubscriptionResumed(event)
	case EventSubscriptionPaused:
		return h.handleSubscriptionPaused(event)
	case EventPaymentSuccess:
		return h.handlePaymentSuccess(event)
	case EventPaymentFailed:
		return h.handlePaymentFailed(event)
	default:
		h.logger.Warn("Unknown webhook event",
			zap.String("event_name", event.Meta.EventName),
		)
		return nil
	}
}

// handleOrderCreated handles order created events
func (h *WebhookHandler) handleOrderCreated(event *WebhookEvent) error {
	var data OrderCreatedData
	if err := json.Unmarshal(event.Data.Attributes, &data); err != nil {
		return fmt.Errorf("failed to unmarshal order created data: %w", err)
	}

	h.logger.Info("Order created",
		zap.Int("order_id", data.OrderID),
		zap.Float64("total", data.Total),
		zap.String("status", data.Status),
	)

	// Create invoice logic here
	// This would typically interact with your database
	// to create an invoice record

	return nil
}

// handleSubscriptionCreated handles subscription created events
func (h *WebhookHandler) handleSubscriptionCreated(event *WebhookEvent) error {
	var data SubscriptionCreatedData
	if err := json.Unmarshal(event.Data.Attributes, &data); err != nil {
		return fmt.Errorf("failed to unmarshal subscription created data: %w", err)
	}

	h.logger.Info("Subscription created",
		zap.Int("customer_id", data.CustomerID),
		zap.String("status", data.Status),
	)

	// Create or update subscription in database
	// Map Lemon Squeezy customer ID to internal user ID
	// Create subscription record with proper plan limits

	return nil
}

// handleSubscriptionUpdated handles subscription updated events
func (h *WebhookHandler) handleSubscriptionUpdated(event *WebhookEvent) error {
	var data SubscriptionUpdatedData
	if err := json.Unmarshal(event.Data.Attributes, &data); err != nil {
		return fmt.Errorf("failed to unmarshal subscription updated data: %w", err)
	}

	h.logger.Info("Subscription updated",
		zap.Int("customer_id", data.CustomerID),
		zap.String("status", data.Status),
	)

	// Update subscription in database
	// Handle plan changes, status changes, etc.

	return nil
}

// handleSubscriptionCancelled handles subscription cancelled events
func (h *WebhookHandler) handleSubscriptionCancelled(event *WebhookEvent) error {
	var data SubscriptionCancelledData
	if err := json.Unmarshal(event.Data.Attributes, &data); err != nil {
		return fmt.Errorf("failed to unmarshal subscription cancelled data: %w", err)
	}

	h.logger.Info("Subscription cancelled",
		zap.Int("customer_id", data.CustomerID),
	)

	// Mark subscription as cancelled in database
	// Set ends_at to the current period end
	// Send cancellation confirmation email

	return nil
}

// handleSubscriptionExpired handles subscription expired events
func (h *WebhookHandler) handleSubscriptionExpired(event *WebhookEvent) error {
	h.logger.Info("Subscription expired",
		zap.String("subscription_id", event.Data.ID),
	)

	// Mark subscription as expired
	// Revoke access to premium features
	// Send expiration notification

	return nil
}

// handleSubscriptionResumed handles subscription resumed events
func (h *WebhookHandler) handleSubscriptionResumed(event *WebhookEvent) error {
	h.logger.Info("Subscription resumed",
		zap.String("subscription_id", event.Data.ID),
	)

	// Update subscription status to active
	// Restore access to premium features

	return nil
}

// handleSubscriptionPaused handles subscription paused events
func (h *WebhookHandler) handleSubscriptionPaused(event *WebhookEvent) error {
	h.logger.Info("Subscription paused",
		zap.String("subscription_id", event.Data.ID),
	)

	// Update subscription status to paused
	// Temporarily suspend access to premium features

	return nil
}

// handlePaymentSuccess handles successful payment events
func (h *WebhookHandler) handlePaymentSuccess(event *WebhookEvent) error {
	h.logger.Info("Payment successful",
		zap.String("subscription_id", event.Data.ID),
	)

	// Update subscription renews_at date
	// Mark invoice as paid
	// Send payment confirmation

	return nil
}

// handlePaymentFailed handles failed payment events
func (h *WebhookHandler) handlePaymentFailed(event *WebhookEvent) error {
	h.logger.Info("Payment failed",
		zap.String("subscription_id", event.Data.ID),
	)

	// Mark subscription as unpaid
	// Send payment failure notification
	// Schedule retry if applicable

	return nil
}
