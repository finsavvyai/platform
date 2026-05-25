package lemonsqueezy

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"go.uber.org/zap"
)

// CreateCheckoutRequest represents a checkout creation request
type CreateCheckoutRequest struct {
	StoreID         string                 `json:"store_id"`
	VariantID       string                 `json:"variant_id"`
	CustomerEmail   string                 `json:"customer_email"`
	CustomerName    string                 `json:"customer_name,omitempty"`
	BillingAddress  BillingAddress         `json:"billing_address,omitempty"`
	ProductOptions  ProductOptions         `json:"product_options,omitempty"`
	CheckoutOptions CheckoutOptions        `json:"checkout_options,omitempty"`
	CheckoutData    map[string]interface{} `json:"checkout_data,omitempty"`
}

// BillingAddress represents a billing address
type BillingAddress struct {
	Country string `json:"country"`
	Zip     string `json:"zip"`
}

// ProductOptions represents product options
type ProductOptions struct {
	RedirectURL        string   `json:"redirect_url,omitempty"`
	ReceiptButtonURL   string   `json:"receipt_button_url,omitempty"`
	ReceiptButtonText  string   `json:"receipt_button_text,omitempty"`
	ReceiptThankYouURL string   `json:"receipt_thank_you_page_url,omitempty"`
	EnabledVariants    []string `json:"enabled_variants,omitempty"`
}

// CheckoutOptions represents checkout options
type CheckoutOptions struct {
	Embed        bool         `json:"embed,omitempty"`
	Media        bool         `json:"media,omitempty"`
	Logo         bool         `json:"logo,omitempty"`
	Dark         bool         `json:"dark,omitempty"`
	Thumbnail    string       `json:"thumbnail,omitempty"`
	ButtonText   string       `json:"button_text,omitempty"`
	DiscountCode string       `json:"discount_code,omitempty"`
	Custom       CustomFields `json:"custom,omitempty"`
}

// CustomFields represents custom fields
type CustomFields struct {
	LogoURL string `json:"logo_url,omitempty"`
}

// CheckoutResponse represents a checkout response
type CheckoutResponse struct {
	Data CheckoutData `json:"data"`
	Meta struct {
		CustomCheckoutURL string `json:"custom_checkout_url"`
	} `json:"meta"`
}

// CheckoutData represents checkout data
type CheckoutData struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	Attributes struct {
		StoreID    string    `json:"store_id"`
		CustomerID string    `json:"customer_id"`
		VariantID  string    `json:"variant_id"`
		URL        string    `json:"url"`
		ExpiresAt  time.Time `json:"expires_at"`
		CreatedAt  time.Time `json:"created_at"`
		UpdatedAt  time.Time `json:"updated_at"`
		TestMode   bool      `json:"test_mode"`
	} `json:"attributes"`
}

// SubscriptionResponse represents a subscription response
type SubscriptionResponse struct {
	Data SubscriptionData `json:"data"`
}

// SubscriptionData represents subscription data
type SubscriptionData struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	Attributes struct {
		CustomerID   int        `json:"customer_id"`
		OrderID      int        `json:"order_id"`
		ProductID    int        `json:"product_id"`
		VariantID    int        `json:"variant_id"`
		Status       string     `json:"status"`
		CardBrand    string     `json:"card_brand"`
		CardLastFour string     `json:"card_last_four"`
		TrialEndsAt  *time.Time `json:"trial_ends_at"`
		RenewsAt     *time.Time `json:"renews_at"`
		EndsAt       *time.Time `json:"ends_at"`
		CreatedAt    time.Time  `json:"created_at"`
		UpdatedAt    time.Time  `json:"updated_at"`
		TestMode     bool       `json:"test_mode"`
		URL          string     `json:"url"`
		CancelURL    string     `json:"cancel_url"`
		UpdateURL    string     `json:"update_url"`
		PortalURL    string     `json:"customer_portal_url"`
	} `json:"attributes"`
}

// CustomerResponse represents a customer response
type CustomerResponse struct {
	Data CustomerData `json:"data"`
}

// CustomerData represents customer data
type CustomerData struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	Attributes struct {
		StoreID   int       `json:"store_id"`
		Email     string    `json:"email"`
		Name      string    `json:"name"`
		Country   string    `json:"country"`
		Zip       string    `json:"zip"`
		Status    string    `json:"status"`
		CreatedAt time.Time `json:"created_at"`
		UpdatedAt time.Time `json:"updated_at"`
		TestMode  bool      `json:"test_mode"`
	} `json:"attributes"`
}

// CreateCheckout creates a new checkout session
func (c *Client) CreateCheckout(ctx context.Context, req *CreateCheckoutRequest) (*CheckoutResponse, error) {
	resp, err := c.makeRequest(ctx, "POST", "/checkouts", req)
	if err != nil {
		return nil, fmt.Errorf("failed to create checkout: %w", err)
	}
	defer resp.Body.Close()

	var checkoutResp CheckoutResponse
	if err := json.NewDecoder(resp.Body).Decode(&checkoutResp); err != nil {
		return nil, fmt.Errorf("failed to decode checkout response: %w", err)
	}

	c.logger.Info("Created checkout",
		zap.String("checkout_id", checkoutResp.Data.ID),
		zap.String("url", checkoutResp.Data.Attributes.URL),
	)

	return &checkoutResp, nil
}

// GetSubscription retrieves a subscription by ID
func (c *Client) GetSubscription(ctx context.Context, subscriptionID string) (*SubscriptionResponse, error) {
	resp, err := c.makeRequest(ctx, "GET", fmt.Sprintf("/subscriptions/%s", subscriptionID), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}
	defer resp.Body.Close()

	var subResp SubscriptionResponse
	if err := json.NewDecoder(resp.Body).Decode(&subResp); err != nil {
		return nil, fmt.Errorf("failed to decode subscription response: %w", err)
	}

	return &subResp, nil
}

// CancelSubscription cancels a subscription
func (c *Client) CancelSubscription(ctx context.Context, subscriptionID string) error {
	req := map[string]interface{}{
		"cancelled": true,
	}

	resp, err := c.makeRequest(ctx, "PATCH", fmt.Sprintf("/subscriptions/%s", subscriptionID), req)
	if err != nil {
		return fmt.Errorf("failed to cancel subscription: %w", err)
	}
	defer resp.Body.Close()

	c.logger.Info("Cancelled subscription",
		zap.String("subscription_id", subscriptionID),
	)

	return nil
}

// PauseSubscription pauses a subscription
func (c *Client) PauseSubscription(ctx context.Context, subscriptionID string, resumeAt time.Time) error {
	req := map[string]interface{}{
		"paused":     true,
		"resumes_at": resumeAt,
	}

	resp, err := c.makeRequest(ctx, "PATCH", fmt.Sprintf("/subscriptions/%s", subscriptionID), req)
	if err != nil {
		return fmt.Errorf("failed to pause subscription: %w", err)
	}
	defer resp.Body.Close()

	c.logger.Info("Paused subscription",
		zap.String("subscription_id", subscriptionID),
		zap.Time("resumes_at", resumeAt),
	)

	return nil
}

// ResumeSubscription resumes a paused subscription
func (c *Client) ResumeSubscription(ctx context.Context, subscriptionID string) error {
	req := map[string]interface{}{
		"paused": false,
	}

	resp, err := c.makeRequest(ctx, "PATCH", fmt.Sprintf("/subscriptions/%s", subscriptionID), req)
	if err != nil {
		return fmt.Errorf("failed to resume subscription: %w", err)
	}
	defer resp.Body.Close()

	c.logger.Info("Resumed subscription",
		zap.String("subscription_id", subscriptionID),
	)

	return nil
}

// ChangeSubscriptionVariant changes a subscription to a different variant
func (c *Client) ChangeSubscriptionVariant(ctx context.Context, subscriptionID, variantID string) error {
	req := map[string]interface{}{
		"variant_id": variantID,
	}

	resp, err := c.makeRequest(ctx, "PATCH", fmt.Sprintf("/subscriptions/%s", subscriptionID), req)
	if err != nil {
		return fmt.Errorf("failed to change subscription variant: %w", err)
	}
	defer resp.Body.Close()

	c.logger.Info("Changed subscription variant",
		zap.String("subscription_id", subscriptionID),
		zap.String("variant_id", variantID),
	)

	return nil
}

// CreateCustomer creates a new customer
func (c *Client) CreateCustomer(ctx context.Context, email, name, storeID string) (*CustomerResponse, error) {
	req := map[string]interface{}{
		"store_id": storeID,
		"name":     name,
		"email":    email,
	}

	resp, err := c.makeRequest(ctx, "POST", "/customers", req)
	if err != nil {
		return nil, fmt.Errorf("failed to create customer: %w", err)
	}
	defer resp.Body.Close()

	var customerResp CustomerResponse
	if err := json.NewDecoder(resp.Body).Decode(&customerResp); err != nil {
		return nil, fmt.Errorf("failed to decode customer response: %w", err)
	}

	c.logger.Info("Created customer",
		zap.String("customer_id", customerResp.Data.ID),
		zap.String("email", email),
	)

	return &customerResp, nil
}

// GetCustomer retrieves a customer by ID
func (c *Client) GetCustomer(ctx context.Context, customerID string) (*CustomerResponse, error) {
	resp, err := c.makeRequest(ctx, "GET", fmt.Sprintf("/customers/%s", customerID), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}
	defer resp.Body.Close()

	var customerResp CustomerResponse
	if err := json.NewDecoder(resp.Body).Decode(&customerResp); err != nil {
		return nil, fmt.Errorf("failed to decode customer response: %w", err)
	}

	return &customerResp, nil
}

// GetSubscriptionUsage retrieves subscription usage information
func (c *Client) GetSubscriptionUsage(ctx context.Context, subscriptionID string) (map[string]interface{}, error) {
	resp, err := c.makeRequest(ctx, "GET", fmt.Sprintf("/subscriptions/%s/usage", subscriptionID), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription usage: %w", err)
	}
	defer resp.Body.Close()

	var usage map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&usage); err != nil {
		return nil, fmt.Errorf("failed to decode usage response: %w", err)
	}

	return usage, nil
}

// MapLemonSqueezyStatusToInternal maps Lemon Squeezy status to internal status
func MapLemonSqueezyStatusToInternal(lsStatus string) string {
	statusMap := map[string]string{
		"on_trial":  entities.SubscriptionStatusOnTrial,
		"active":    entities.SubscriptionStatusActive,
		"cancelled": entities.SubscriptionStatusCancelled,
		"expired":   entities.SubscriptionStatusExpired,
		"unpaid":    entities.SubscriptionStatusUnpaid,
		"paused":    entities.SubscriptionStatusPaused,
	}

	if internal, exists := statusMap[lsStatus]; exists {
		return internal
	}

	return entities.SubscriptionStatusExpired
}
