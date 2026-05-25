package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// LemonSqueezy service for subscription management
type LemonSqueezyService struct {
	apiKey     string
	storeID    string
	logger     *zap.Logger
	httpClient *http.Client
	baseURL    string
}

// LemonSqueezy API responses
type (
	// CheckoutRequest represents checkout creation request
	CheckoutRequest struct {
		StoreID       string            `json:"store_id"`
		VariantID     string            `json:"variant_id"`
		CustomerEmail string            `json:"customer_email,omitempty"`
		CustomData    map[string]string `json:"custom_data,omitempty"`
		TestMode      bool              `json:"test_mode,omitempty"`
	}

	// CheckoutResponse represents checkout creation response
	CheckoutResponse struct {
		Data struct {
			Attributes struct {
				URL            string `json:"url"`
				CustomerEmail  string `json:"customer_email"`
				CustomerID     int64  `json:"customer_id"`
				OrderID        int64  `json:"order_id"`
				OrderNumber    int64  `json:"order_number"`
				SubscriptionID int64  `json:"subscription_id"`
			} `json:"attributes"`
		} `json:"data"`
	}

	// LicenseValidationRequest represents license validation request
	LicenseValidationRequest struct {
		LicenseKey string `json:"license_key"`
	}

	// LicenseValidationResponse represents license validation response
	LicenseValidationResponse struct {
		Valid          bool `json:"valid"`
		LicenseDetails struct {
			LicenseKey    string    `json:"license_key"`
			OrderID       int64     `json:"order_id"`
			OrderItemID   int64     `json:"order_item_id"`
			ProductID     int64     `json:"product_id"`
			VariantID     int64     `json:"variant_id"`
			VariantName   string    `json:"variant_name"`
			CustomerID    int64     `json:"customer_id"`
			CustomerEmail string    `json:"customer_email"`
			Status        string    `json:"status"`
			ExpiresAt     time.Time `json:"expires_at"`
			CreatedAt     time.Time `json:"created_at"`
		} `json:"license"`
	}
)

// NewLemonSqueezyService creates a new LemonSqueezy service
func NewLemonSqueezyService(apiKey, storeID string, logger *zap.Logger) *LemonSqueezyService {
	return &LemonSqueezyService{
		apiKey:     apiKey,
		storeID:    storeID,
		logger:     logger,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    "https://api.lemonsqueezy.com/v1",
	}
}

// CreateCheckout creates a new checkout session
func (s *LemonSqueezyService) CreateCheckout(ctx context.Context, req CheckoutRequest) (*CheckoutResponse, error) {
	req.StoreID = s.storeID

	jsonData, err := json.Marshal(req)
	if err != nil {
		s.logger.Error("Failed to marshal checkout request", zap.Error(err))
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/checkouts", bytes.NewBuffer(jsonData))
	if err != nil {
		s.logger.Error("Failed to create checkout request", zap.Error(err))
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		s.logger.Error("Failed to create checkout", zap.Error(err))
		return nil, fmt.Errorf("failed to create checkout: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		s.logger.Error("Checkout creation failed",
			zap.Int("status", resp.StatusCode),
			zap.String("response", string(body)))
		return nil, fmt.Errorf("checkout creation failed with status %d: %s", resp.StatusCode, string(body))
	}

	var checkoutResp CheckoutResponse
	if err := json.NewDecoder(resp.Body).Decode(&checkoutResp); err != nil {
		s.logger.Error("Failed to decode checkout response", zap.Error(err))
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	s.logger.Info("Checkout created successfully",
		zap.String("checkout_url", checkoutResp.Data.Attributes.URL),
		zap.String("customer_email", checkoutResp.Data.Attributes.CustomerEmail),
		zap.Int64("order_id", checkoutResp.Data.Attributes.OrderID))

	return &checkoutResp, nil
}

// ValidateLicense validates a license key
func (s *LemonSqueezyService) ValidateLicense(ctx context.Context, licenseKey string) (*LicenseValidationResponse, error) {
	req := LicenseValidationRequest{LicenseKey: licenseKey}

	jsonData, err := json.Marshal(req)
	if err != nil {
		s.logger.Error("Failed to marshal license validation request", zap.Error(err))
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/licenses/validate", bytes.NewBuffer(jsonData))
	if err != nil {
		s.logger.Error("Failed to create license validation request", zap.Error(err))
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		s.logger.Error("Failed to validate license", zap.Error(err))
		return nil, fmt.Errorf("failed to validate license: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		s.logger.Error("License validation failed",
			zap.Int("status", resp.StatusCode),
			zap.String("response", string(body)))

		// Return a response with valid=false for invalid licenses
		return &LicenseValidationResponse{Valid: false}, nil
	}

	var validationResp LicenseValidationResponse
	if err := json.NewDecoder(resp.Body).Decode(&validationResp); err != nil {
		s.logger.Error("Failed to decode license validation response", zap.Error(err))
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	s.logger.Info("License validation completed",
		zap.Bool("valid", validationResp.Valid),
		zap.String("customer_email", validationResp.LicenseDetails.CustomerEmail),
		zap.String("variant_name", validationResp.LicenseDetails.VariantName))

	return &validationResp, nil
}

// GetSubscriptionDetails retrieves subscription details
func (s *LemonSqueezyService) GetSubscriptionDetails(ctx context.Context, subscriptionID string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/subscriptions/%s", s.baseURL, subscriptionID)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)
	httpReq.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription details: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get subscription details with status %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result, nil
}

// CancelSubscription cancels a subscription
func (s *LemonSqueezyService) CancelSubscription(ctx context.Context, subscriptionID string) error {
	url := fmt.Sprintf("%s/subscriptions/%s", s.baseURL, subscriptionID)

	jsonData := map[string]interface{}{
		"cancelled": true,
		"reason":    "User requested cancellation",
	}

	reqBody, err := json.Marshal(jsonData)
	if err != nil {
		return fmt.Errorf("failed to marshal cancellation request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "PATCH", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to cancel subscription: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to cancel subscription with status %d: %s", resp.StatusCode, string(body))
	}

	s.logger.Info("Subscription cancelled successfully", zap.String("subscription_id", subscriptionID))
	return nil
}

// GetProductVariants returns all available product variants
func (s *LemonSqueezyService) GetProductVariants(ctx context.Context, productID string) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/variants?filter[product_id]=%s", s.baseURL, productID)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)
	httpReq.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get product variants: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get product variants with status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Data []map[string]interface{} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Data, nil
}

// CreateWebhookHandler creates a handler for LemonSqueezy webhooks
func (s *LemonSqueezyService) CreateWebhookHandler(secret string) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		// Verify webhook signature
		signature := r.Header.Get("X-Signature")
		if signature == "" {
			http.Error(w, "Missing signature", http.StatusUnauthorized)
			return
		}

		// Read webhook payload
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read body", http.StatusBadRequest)
			return
		}

		// TODO: Implement signature verification using the secret
		// For now, just log the webhook event
		var webhookEvent map[string]interface{}
		if err := json.Unmarshal(body, &webhookEvent); err != nil {
			s.logger.Error("Failed to parse webhook event", zap.Error(err))
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		s.logger.Info("Received LemonSqueezy webhook",
			zap.String("event_name", getEventName(webhookEvent)),
			zap.Any("event_data", webhookEvent))

		// Process webhook event
		if err := s.processWebhookEvent(webhookEvent); err != nil {
			s.logger.Error("Failed to process webhook event", zap.Error(err))
			http.Error(w, "Failed to process event", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}
}

// processWebhookEvent processes incoming webhook events
func (s *LemonSqueezyService) processWebhookEvent(event map[string]interface{}) error {
	eventName := getEventName(event)

	switch eventName {
	case "order_created", "subscription_created":
		// Handle new subscription
		s.logger.Info("New subscription created", zap.Any("event", event))
	case "subscription_updated":
		// Handle subscription update
		s.logger.Info("Subscription updated", zap.Any("event", event))
	case "subscription_cancelled":
		// Handle subscription cancellation
		s.logger.Info("Subscription cancelled", zap.Any("event", event))
	case "subscription_payment_succeeded":
		// Handle successful payment
		s.logger.Info("Payment succeeded", zap.Any("event", event))
	case "subscription_payment_failed":
		// Handle failed payment
		s.logger.Warn("Payment failed", zap.Any("event", event))
	default:
		s.logger.Info("Unhandled webhook event", zap.String("event", eventName), zap.Any("event", event))
	}

	return nil
}

// getEventName extracts the event name from webhook payload
func getEventName(event map[string]interface{}) string {
	if meta, ok := event["meta"].(map[string]interface{}); ok {
		if eventName, ok := meta["event_name"].(string); ok {
			return eventName
		}
	}
	return "unknown"
}

// SubscriptionTier represents subscription tier configuration
type SubscriptionTier struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	VariantID string   `json:"variant_id"`
	Price     float64  `json:"price"`
	Currency  string   `json:"currency"`
	Features  Features `json:"features"`
}

// Features represents subscription tier features
type Features struct {
	MaxConnections     int      `json:"max_connections"`
	SupportedDatabases []string `json:"supported_databases"`
	AdvancedFeatures   bool     `json:"advanced_features"`
	SupportLevel       string   `json:"support_level"`
	AIFeatures         bool     `json:"ai_features"`
	TeamCollaboration  bool     `json:"team_collaboration"`
}

// GetSubscriptionTiers returns all available subscription tiers
func GetSubscriptionTiers() []SubscriptionTier {
	return []SubscriptionTier{
		{
			ID:        "starter",
			Name:      "Starter",
			VariantID: "starter_variant_id", // Replace with actual variant ID
			Price:     9.99,
			Currency:  "USD",
			Features: Features{
				MaxConnections:     5,
				SupportedDatabases: []string{"postgresql", "mysql", "sqlite"},
				AdvancedFeatures:   false,
				SupportLevel:       "community",
				AIFeatures:         false,
				TeamCollaboration:  false,
			},
		},
		{
			ID:        "professional",
			Name:      "Professional",
			VariantID: "professional_variant_id", // Replace with actual variant ID
			Price:     29.99,
			Currency:  "USD",
			Features: Features{
				MaxConnections:     25,
				SupportedDatabases: []string{"postgresql", "mysql", "mongodb", "redis", "sqlite"},
				AdvancedFeatures:   true,
				SupportLevel:       "priority",
				AIFeatures:         true,
				TeamCollaboration:  true,
			},
		},
		{
			ID:        "enterprise",
			Name:      "Enterprise",
			VariantID: "enterprise_variant_id", // Replace with actual variant ID
			Price:     99.99,
			Currency:  "USD",
			Features: Features{
				MaxConnections:     -1, // Unlimited
				SupportedDatabases: []string{"postgresql", "mysql", "mongodb", "redis", "sqlite", "sqlserver", "oracle"},
				AdvancedFeatures:   true,
				SupportLevel:       "enterprise",
				AIFeatures:         true,
				TeamCollaboration:  true,
			},
		},
	}
}
