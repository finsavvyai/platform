//go:build legacy_migrated
// +build legacy_migrated

package webhooks

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"quantumbeam/internal/billing/models"
	"quantumbeam/internal/billing/services"
	"quantumbeam/internal/logger"
)

// LemonSqueezyWebhook handles Lemon Squeezy webhooks
type LemonSqueezyWebhook struct {
	billingService *services.BillingService
	lemonSqueezy   *services.LemonSqueezyService
	log            logger.Logger
	secret         string
}

// NewLemonSqueezyWebhook creates a new Lemon Squeezy webhook handler
func NewLemonSqueezyWebhook(
	billingService *services.BillingService,
	lemonSqueezy *services.LemonSqueezyService,
	secret string,
	log logger.Logger,
) *LemonSqueezyWebhook {
	return &LemonSqueezyWebhook{
		billingService: billingService,
		lemonSqueezy:   lemonSqueezy,
		log:            log,
		secret:         secret,
	}
}

// WebhookEvent represents a Lemon Squeezy webhook event
type WebhookEvent struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	Meta      *WebhookMeta    `json:"meta,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

type WebhookMeta struct {
	CustomData map[string]interface{} `json:"custom_data,omitempty"`
	TestMode   bool                   `json:"test_mode"`
	EventName  string                 `json:"event_name"`
}

// SubscriptionCreated represents subscription.created webhook
type SubscriptionCreated struct {
	Type       string                  `json:"type"`
	ID         string                  `json:"id"`
	Attributes SubscriptionCreatedAttr `json:"attributes"`
}

type SubscriptionCreatedAttr struct {
	CustomerID   int64      `json:"customer_id"`
	OrderID      int64      `json:"order_id"`
	OrderItemID  int64      `json:"order_item_id"`
	ProductID    int64      `json:"product_id"`
	VariantID    int64      `json:"variant_id"`
	ProductName  string     `json:"product_name"`
	VariantName  string     `json:"variant_name"`
	UserName     string     `json:"user_name"`
	UserEmail    string     `json:"user_email"`
	Status       string     `json:"status"`
	Price        float64    `json:"price"`
	Currency     string     `json:"currency"`
	BillingCycle string     `json:"billing_cycle"`
	TrialDays    int        `json:"trial_days"`
	BilledAt     *time.Time `json:"billed_at"`
	RenewsAt     *time.Time `json:"renews_at"`
	EndsAt       *time.Time `json:"ends_at"`
	TrialEndsAt  *time.Time `json:"trial_ends_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	TestMode     bool       `json:"test_mode"`
}

// SubscriptionUpdated represents subscription.updated webhook
type SubscriptionUpdated struct {
	Type       string                  `json:"type"`
	ID         string                  `json:"id"`
	Attributes SubscriptionUpdatedAttr `json:"attributes"`
}

type SubscriptionUpdatedAttr struct {
	SubscriptionCreatedAttr
	CardBrand    *string `json:"card_brand"`
	CardLastFour *string `json:"card_last_four"`
	Cancelled    *bool   `json:"cancelled"`
	Paused       *bool   `json:"paused"`
}

// OrderCreated represents order.created webhook
type OrderCreated struct {
	Type       string           `json:"type"`
	ID         string           `json:"id"`
	Attributes OrderCreatedAttr `json:"attributes"`
}

type OrderCreatedAttr struct {
	CustomerID    int64      `json:"customer_id"`
	Identifier    string     `json:"identifier"`
	OrderNumber   int        `json:"order_number"`
	Products      string     `json:"products"`
	Discount      float64    `json:"discount"`
	Tax           float64    `json:"tax"`
	Currency      string     `json:"currency"`
	Subtotal      float64    `json:"subtotal"`
	DiscountTotal float64    `json:"discount_total"`
	TaxTotal      float64    `json:"tax_total"`
	Total         float64    `json:"total"`
	FirstName     string     `json:"first_name"`
	LastName      string     `json:"last_name"`
	Email         string     `json:"email"`
	Status        string     `json:"status"`
	Paid          bool       `json:"paid"`
	PaidAt        *time.Time `json:"paid_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	TestMode      bool       `json:"test_mode"`
}

// HandleWebhook handles incoming Lemon Squeezy webhooks
func (w *LemonSqueezyWebhook) HandleWebhook(c *gin.Context) {
	// Read the request body
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		w.log.Error("Failed to read webhook body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Verify webhook signature
	signature := c.GetHeader("X-Signature")
	if !w.verifySignature(body, signature) {
		w.log.Warn("Invalid webhook signature", "signature", signature)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	// Parse webhook event
	var event WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		w.log.Error("Failed to parse webhook event", "error", err, "body", string(body))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse webhook event"})
		return
	}

	w.log.Info("Received Lemon Squeezy webhook",
		"event_id", event.ID,
		"event_type", event.Type,
		"test_mode", event.Meta != nil && event.Meta.TestMode,
	)

	// Process the event based on type
	if err := w.processEvent(c.Request.Context(), event); err != nil {
		w.log.Error("Failed to process webhook event",
			"error", err,
			"event_id", event.ID,
			"event_type", event.Type,
		)

		// Still return 200 to avoid Lemon Squeezy retries
		c.JSON(http.StatusOK, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// processEvent processes a webhook event
func (w *LemonSqueezyWebhook) processEvent(ctx context.Context, event WebhookEvent) error {
	switch event.Type {
	case "subscription_created":
		return w.handleSubscriptionCreated(ctx, event)
	case "subscription_updated":
		return w.handleSubscriptionUpdated(ctx, event)
	case "subscription_cancelled":
		return w.handleSubscriptionCancelled(ctx, event)
	case "subscription_paused":
		return w.handleSubscriptionPaused(ctx, event)
	case "subscription_resumed":
		return w.handleSubscriptionResumed(ctx, event)
	case "subscription_expired":
		return w.handleSubscriptionExpired(ctx, event)
	case "order_created":
		return w.handleOrderCreated(ctx, event)
	case "order_paid":
		return w.handleOrderPaid(ctx, event)
	case "order_refunded":
		return w.handleOrderRefunded(ctx, event)
	default:
		w.log.Info("Unhandled webhook event type", "event_type", event.Type)
		return nil
	}
}

// handleSubscriptionCreated handles subscription.created webhook
func (w *LemonSqueezyWebhook) handleSubscriptionCreated(ctx context.Context, event WebhookEvent) error {
	var subEvent SubscriptionCreated
	if err := json.Unmarshal(event.Data, &subEvent); err != nil {
		return fmt.Errorf("failed to unmarshal subscription created event: %w", err)
	}

	attributes := map[string]interface{}{
		"customer_id":   subEvent.Attributes.CustomerID,
		"order_id":      subEvent.Attributes.OrderID,
		"order_item_id": subEvent.Attributes.OrderItemID,
		"product_id":    subEvent.Attributes.ProductID,
		"variant_id":    subEvent.Attributes.VariantID,
		"product_name":  subEvent.Attributes.ProductName,
		"variant_name":  subEvent.Attributes.VariantName,
		"user_name":     subEvent.Attributes.UserName,
		"user_email":    subEvent.Attributes.UserEmail,
		"status":        subEvent.Attributes.Status,
		"price":         subEvent.Attributes.Price,
		"currency":      subEvent.Attributes.Currency,
		"billing_cycle": subEvent.Attributes.BillingCycle,
		"trial_days":    subEvent.Attributes.TrialDays,
		"billed_at":     subEvent.Attributes.BilledAt,
		"renews_at":     subEvent.Attributes.RenewsAt,
		"ends_at":       subEvent.Attributes.EndsAt,
		"trial_ends_at": subEvent.Attributes.TrialEndsAt,
		"created_at":    subEvent.Attributes.CreatedAt,
		"updated_at":    subEvent.Attributes.UpdatedAt,
		"test_mode":     subEvent.Attributes.TestMode,
	}

	err := w.billingService.UpdateSubscriptionFromWebhook(ctx, subEvent.ID, attributes)
	if err != nil {
		return fmt.Errorf("failed to update subscription from webhook: %w", err)
	}

	w.log.Info("Created subscription from webhook",
		"subscription_id", subEvent.ID,
		"customer_email", subEvent.Attributes.UserEmail,
		"variant_name", subEvent.Attributes.VariantName,
		"status", subEvent.Attributes.Status,
	)

	return nil
}

// handleSubscriptionUpdated handles subscription.updated webhook
func (w *LemonSqueezyWebhook) handleSubscriptionUpdated(ctx context.Context, event WebhookEvent) error {
	var subEvent SubscriptionUpdated
	if err := json.Unmarshal(event.Data, &subEvent); err != nil {
		return fmt.Errorf("failed to unmarshal subscription updated event: %w", err)
	}

	attributes := map[string]interface{}{
		"customer_id":    subEvent.Attributes.CustomerID,
		"order_id":       subEvent.Attributes.OrderID,
		"order_item_id":  subEvent.Attributes.OrderItemID,
		"product_id":     subEvent.Attributes.ProductID,
		"variant_id":     subEvent.Attributes.VariantID,
		"product_name":   subEvent.Attributes.ProductName,
		"variant_name":   subEvent.Attributes.VariantName,
		"user_name":      subEvent.Attributes.UserName,
		"user_email":     subEvent.Attributes.UserEmail,
		"status":         subEvent.Attributes.Status,
		"price":          subEvent.Attributes.Price,
		"currency":       subEvent.Attributes.Currency,
		"billing_cycle":  subEvent.Attributes.BillingCycle,
		"card_brand":     subEvent.Attributes.CardBrand,
		"card_last_four": subEvent.Attributes.CardLastFour,
		"cancelled":      subEvent.Attributes.Cancelled,
		"paused":         subEvent.Attributes.Paused,
		"billed_at":      subEvent.Attributes.BilledAt,
		"renews_at":      subEvent.Attributes.RenewsAt,
		"ends_at":        subEvent.Attributes.EndsAt,
		"trial_ends_at":  subEvent.Attributes.TrialEndsAt,
		"updated_at":     subEvent.Attributes.UpdatedAt,
		"test_mode":      subEvent.Attributes.TestMode,
	}

	err := w.billingService.UpdateSubscriptionFromWebhook(ctx, subEvent.ID, attributes)
	if err != nil {
		return fmt.Errorf("failed to update subscription from webhook: %w", err)
	}

	w.log.Info("Updated subscription from webhook",
		"subscription_id", subEvent.ID,
		"status", subEvent.Attributes.Status,
	)

	return nil
}

// handleSubscriptionCancelled handles subscription.cancelled webhook
func (w *LemonSqueezyWebhook) handleSubscriptionCancelled(ctx context.Context, event WebhookEvent) error {
	// Similar to updated but with cancelled status
	return w.handleSubscriptionUpdated(ctx, event)
}

// handleSubscriptionPaused handles subscription.paused webhook
func (w *LemonSqueezyWebhook) handleSubscriptionPaused(ctx context.Context, event WebhookEvent) error {
	// Similar to updated but with paused status
	return w.handleSubscriptionUpdated(ctx, event)
}

// handleSubscriptionResumed handles subscription.resumed webhook
func (w *LemonSqueezyWebhook) handleSubscriptionResumed(ctx context.Context, event WebhookEvent) error {
	// Similar to updated but with active status
	return w.handleSubscriptionUpdated(ctx, event)
}

// handleSubscriptionExpired handles subscription.expired webhook
func (w *LemonSqueezyWebhook) handleSubscriptionExpired(ctx context.Context, event WebhookEvent) error {
	// Similar to updated but with expired status
	return w.handleSubscriptionUpdated(ctx, event)
}

// handleOrderCreated handles order.created webhook
func (w *LemonSqueezyWebhook) handleOrderCreated(ctx context.Context, event WebhookEvent) error {
	var orderEvent OrderCreated
	if err := json.Unmarshal(event.Data, &orderEvent); err != nil {
		return fmt.Errorf("failed to unmarshal order created event: %w", err)
	}

	w.log.Info("Order created from webhook",
		"order_id", orderEvent.ID,
		"order_number", orderEvent.Attributes.OrderNumber,
		"customer_email", orderEvent.Attributes.Email,
		"total", orderEvent.Attributes.Total,
		"currency", orderEvent.Attributes.Currency,
		"status", orderEvent.Attributes.Status,
		"paid", orderEvent.Attributes.Paid,
	)

	// TODO: Create invoice record
	return nil
}

// handleOrderPaid handles order.paid webhook
func (w *LemonSqueezyWebhook) handleOrderPaid(ctx context.Context, event WebhookEvent) error {
	var orderEvent OrderCreated
	if err := json.Unmarshal(event.Data, &orderEvent); err != nil {
		return fmt.Errorf("failed to unmarshal order paid event: %w", err)
	}

	w.log.Info("Order paid from webhook",
		"order_id", orderEvent.ID,
		"order_number", orderEvent.Attributes.OrderNumber,
		"customer_email", orderEvent.Attributes.Email,
		"total", orderEvent.Attributes.Total,
		"paid_at", orderEvent.Attributes.PaidAt,
	)

	// TODO: Update invoice status to paid
	return nil
}

// handleOrderRefunded handles order.refunded webhook
func (w *LemonSqueezyWebhook) handleOrderRefunded(ctx context.Context, event WebhookEvent) error {
	var orderEvent OrderCreated
	if err := json.Unmarshal(event.Data, &orderEvent); err != nil {
		return fmt.Errorf("failed to unmarshal order refunded event: %w", err)
	}

	w.log.Info("Order refunded from webhook",
		"order_id", orderEvent.ID,
		"order_number", orderEvent.Attributes.OrderNumber,
		"customer_email", orderEvent.Attributes.Email,
		"total", orderEvent.Attributes.Total,
	)

	// TODO: Update invoice status to refunded
	return nil
}

// verifySignature verifies the webhook signature
func (w *LemonSqueezyWebhook) verifySignature(body []byte, signature string) bool {
	if w.secret == "" {
		// Skip verification if no secret configured (development only)
		return true
	}

	// Lemon Squeezy signatures are in format: "sha256=<hex_signature>"
	expectedPrefix := "sha256="
	if len(signature) < len(expectedPrefix) || !signature[:len(expectedPrefix)] == expectedPrefix {
		return false
	}

	receivedSignature := signature[len(expectedPrefix):]

	// Calculate expected signature
	h := hmac.New(sha256.New, []byte(w.secret))
	h.Write(body)
	expectedSignature := hex.EncodeToString(h.Sum(nil))

	// Compare signatures
	return hmac.Equal([]byte(receivedSignature), []byte(expectedSignature))
}

// StoreWebhookEvent stores a webhook event for processing
func (w *LemonSqueezyWebhook) StoreWebhookEvent(ctx context.Context, event WebhookEvent) error {
	// Create billing event record
	billingEvent := &models.BillingEvent{
		ID:        models.NewID(),
		EventType: event.Type,
		WebhookID: event.ID,
		Processed: false,
		Data:      string(event.Data),
		CreatedAt: time.Now(),
	}

	// TODO: Save to database
	_ = billingEvent

	return nil
}

// RetryFailedEvents retries failed webhook events
func (w *LemonSqueezyWebhook) RetryFailedEvents(ctx context.Context) error {
	// TODO: Implement retry logic for failed webhook events
	return nil
}