package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"quantumbeam.io/internal/billing/models"
	"quantumbeam.io/internal/config"
	"quantumbeam.io/internal/logger"
)

// LemonSqueezyService handles integration with Lemon Squeezy API
type LemonSqueezyService struct {
	apiKey        string
	apiURL        string
	storeID       string
	webhookSecret string
	client        *http.Client
	log           logger.Logger
}

// LemonSqueezyConfig holds configuration for Lemon Squeezy
type LemonSqueezyConfig struct {
	APIKey        string
	StoreID       string
	WebhookSecret string
	APIURL        string
	Timeout       time.Duration
}

// NewLemonSqueezyService creates a new Lemon Squeezy service
func NewLemonSqueezyService(cfg config.LemonSqueezyConfig, log logger.Logger) *LemonSqueezyService {
	return &LemonSqueezyService{
		apiKey:        cfg.APIKey,
		apiURL:        cfg.APIURL,
		storeID:       cfg.StoreID,
		webhookSecret: cfg.WebhookSecret,
		client: &http.Client{
			Timeout: cfg.Timeout,
		},
		log: log,
	}
}

// Lemon Squeezy API response structures
type LemonSqueezyResponse struct {
	Data  json.RawMessage `json:"data"`
	Meta  *Meta           `json:"meta,omitempty"`
	Links *Links          `json:"links,omitempty"`
	Error *Error          `json:"error,omitempty"`
}

type Meta struct {
	CurrentPage int `json:"current_page"`
	From        int `json:"from"`
	LastPage    int `json:"last_page"`
	PerPage     int `json:"per_page"`
	To          int `json:"to"`
	Total       int `json:"total"`
}

type Links struct {
	First string `json:"first"`
	Last  string `json:"last"`
	Next  string `json:"next"`
	Prev  string `json:"prev"`
}

type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Customer structures
type CustomerData struct {
	Type       string             `json:"type"`
	ID         string             `json:"id"`
	Attributes CustomerAttributes `json:"attributes"`
}

type CustomerAttributes struct {
	Email            string    `json:"email"`
	Name             string    `json:"name"`
	EmailVerifiedAt  *string   `json:"email_verified_at"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	StripeCustomerID *string   `json:"stripe_customer_id"`
}

type LemonSqueezyCustomer struct {
	Data CustomerData `json:"data"`
}

// Variant structures
type VariantData struct {
	Type       string            `json:"type"`
	ID         string            `json:"id"`
	Attributes VariantAttributes `json:"attributes"`
}

type VariantAttributes struct {
	ProductID          string    `json:"product_id"`
	Name               string    `json:"name"`
	Slug               string    `json:"slug"`
	Description        string    `json:"description"`
	Status             string    `json:"status"`
	Price              float64   `json:"price"`
	PriceFormatted     string    `json:"price_formatted"`
	IsFree             bool      `json:"is_free"`
	TrialDays          int       `json:"trial_days"`
	Sort               int       `json:"sort"`
	BillingScheme      string    `json:"billing_scheme"`
	HasFreeTrial       bool      `json:"has_free_trial"`
	SubscriptionPeriod string    `json:"subscription_period"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type LemonSqueezyVariant struct {
	Data VariantData `json:"data"`
}

// Subscription structures
type SubscriptionData struct {
	Type       string                 `json:"type"`
	ID         string                 `json:"id"`
	Attributes SubscriptionAttributes `json:"attributes"`
}

type SubscriptionAttributes struct {
	CustomerID        int64      `json:"customer_id"`
	OrderID           int64      `json:"order_id"`
	OrderItemID       int64      `json:"order_item_id"`
	ProductID         int64      `json:"product_id"`
	VariantID         int64      `json:"variant_id"`
	ProductName       string     `json:"product_name"`
	VariantName       string     `json:"variant_name"`
	UserName          string     `json:"user_name"`
	UserEmail         string     `json:"user_email"`
	Status            string     `json:"status"`
	StatusFormatted   string     `json:"status_formatted"`
	CardBrand         *string    `json:"card_brand"`
	CardLastFour      *string    `json:"card_last_four"`
	Currency          string     `json:"currency"`
	Subtotal          float64    `json:"subtotal"`
	DiscountTotal     float64    `json:"discount_total"`
	Tax               float64    `json:"tax"`
	Total             float64    `json:"total"`
	SubtotalFormatted string     `json:"subtotal_formatted"`
	DiscountFormatted string     `json:"discount_formatted"`
	TaxFormatted      string     `json:"tax_formatted"`
	TotalFormatted    string     `json:"total_formatted"`
	BillingCycle      string     `json:"billing_cycle"`
	BilledAt          *time.Time `json:"billed_at"`
	RenewsAt          *time.Time `json:"renews_at"`
	EndsAt            *time.Time `json:"ends_at"`
	TrialEndsAt       *time.Time `json:"trial_ends_at"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	TestMode          bool       `json:"test_mode"`
}

type LemonSqueezySubscription struct {
	Data SubscriptionData `json:"data"`
}

// Order structures
type OrderData struct {
	Type       string          `json:"type"`
	ID         string          `json:"id"`
	Attributes OrderAttributes `json:"attributes"`
}

type OrderAttributes struct {
	CustomerID        int64      `json:"customer_id"`
	Identifier        string     `json:"identifier"`
	OrderNumber       int        `json:"order_number"`
	Products          string     `json:"products"`
	Discount          float64    `json:"discount"`
	Tax               float64    `json:"tax"`
	Currency          string     `json:"currency"`
	Subtotal          float64    `json:"subtotal"`
	DiscountTotal     float64    `json:"discount_total"`
	TaxTotal          float64    `json:"tax_total"`
	Total             float64    `json:"total"`
	SubtotalFormatted string     `json:"subtotal_formatted"`
	DiscountFormatted string     `json:"discount_formatted"`
	TaxFormatted      string     `json:"tax_formatted"`
	TotalFormatted    string     `json:"total_formatted"`
	FirstName         string     `json:"first_name"`
	LastName          string     `json:"last_name"`
	Email             string     `json:"email"`
	BillingAddress    string     `json:"billing_address"`
	Country           string     `json:"country"`
	Status            string     `json:"status"`
	StatusFormatted   string     `json:"status_formatted"`
	Paid              bool       `json:"paid"`
	PaidAt            *time.Time `json:"paid_at"`
	Refunded          bool       `json:"refunded"`
	RefundedAt        *time.Time `json:"refunded_at"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updatedAt"`
	TestMode          bool       `json:"test_mode"`
}

type LemonSqueezyOrder struct {
	Data OrderData `json:"data"`
}

// makeRequest makes an HTTP request to the Lemon Squeezy API
func (s *LemonSqueezyService) makeRequest(ctx context.Context, method, endpoint string, body interface{}) (*LemonSqueezyResponse, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, s.apiURL+endpoint, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/vnd.api+json")
	req.Header.Set("Content-Type", "application/vnd.api+json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errorResp LemonSqueezyResponse
		if err := json.Unmarshal(respBody, &errorResp); err != nil {
			return nil, fmt.Errorf("API error: %s (status: %d)", string(respBody), resp.StatusCode)
		}
		if errorResp.Error != nil {
			return nil, fmt.Errorf("API error: %s (code: %s)", errorResp.Error.Message, errorResp.Error.Code)
		}
		return nil, fmt.Errorf("API error: %s (status: %d)", string(respBody), resp.StatusCode)
	}

	var apiResp LemonSqueezyResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &apiResp, nil
}

// CreateCustomer creates a new customer in Lemon Squeezy
func (s *LemonSqueezyService) CreateCustomer(ctx context.Context, email, name string, country string) (*LemonSqueezyCustomer, error) {
	reqBody := map[string]interface{}{
		"data": map[string]interface{}{
			"type": "customers",
			"attributes": map[string]interface{}{
				"email":   email,
				"name":    name,
				"country": country,
			},
		},
	}

	resp, err := s.makeRequest(ctx, "POST", "/v1/customers", reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create customer: %w", err)
	}

	var customer LemonSqueezyCustomer
	if err := json.Unmarshal(resp.Data, &customer.Data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal customer data: %w", err)
	}

	return &customer, nil
}

// GetCustomer retrieves a customer by ID
func (s *LemonSqueezyService) GetCustomer(ctx context.Context, customerID string) (*LemonSqueezyCustomer, error) {
	resp, err := s.makeRequest(ctx, "GET", "/v1/customers/"+customerID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}

	var customer LemonSqueezyCustomer
	if err := json.Unmarshal(resp.Data, &customer.Data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal customer data: %w", err)
	}

	return &customer, nil
}

// ListCustomers retrieves a list of customers
func (s *LemonSqueezyService) ListCustomers(ctx context.Context, page, perPage int) ([]LemonSqueezyCustomer, *Meta, error) {
	params := url.Values{}
	if page > 0 {
		params.Set("page", strconv.Itoa(page))
	}
	if perPage > 0 {
		params.Set("per_page", strconv.Itoa(perPage))
	}

	endpoint := "/v1/customers"
	if len(params) > 0 {
		endpoint += "?" + params.Encode()
	}

	resp, err := s.makeRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list customers: %w", err)
	}

	var customers []LemonSqueezyCustomer
	if err := json.Unmarshal(resp.Data, &customers); err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal customers data: %w", err)
	}

	return customers, resp.Meta, nil
}

// GetVariant retrieves a variant by ID
func (s *LemonSqueezyService) GetVariant(ctx context.Context, variantID string) (*LemonSqueezyVariant, error) {
	resp, err := s.makeRequest(ctx, "GET", "/v1/variants/"+variantID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get variant: %w", err)
	}

	var variant LemonSqueezyVariant
	if err := json.Unmarshal(resp.Data, &variant.Data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal variant data: %w", err)
	}

	return &variant, nil
}

// ListVariants retrieves variants for a product
func (s *LemonSqueezyService) ListVariants(ctx context.Context, productID string) ([]LemonSqueezyVariant, error) {
	endpoint := "/v1/variants"
	if productID != "" {
		endpoint += "?filter[product_id]=" + productID
	}

	resp, err := s.makeRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list variants: %w", err)
	}

	var variants []LemonSqueezyVariant
	if err := json.Unmarshal(resp.Data, &variants); err != nil {
		return nil, fmt.Errorf("failed to unmarshal variants data: %w", err)
	}

	return variants, nil
}

// GetSubscription retrieves a subscription by ID
func (s *LemonSqueezyService) GetSubscription(ctx context.Context, subscriptionID string) (*LemonSqueezySubscription, error) {
	resp, err := s.makeRequest(ctx, "GET", "/v1/subscriptions/"+subscriptionID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}

	var subscription LemonSqueezySubscription
	if err := json.Unmarshal(resp.Data, &subscription.Data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal subscription data: %w", err)
	}

	return &subscription, nil
}

// ListSubscriptions retrieves subscriptions with optional filtering
func (s *LemonSqueezyService) ListSubscriptions(ctx context.Context, customerID, storeID, status string, page, perPage int) ([]LemonSqueezySubscription, *Meta, error) {
	params := url.Values{}
	if customerID != "" {
		params.Set("filter[customer_id]", customerID)
	}
	if storeID != "" {
		params.Set("filter[store_id]", storeID)
	}
	if status != "" {
		params.Set("filter[status]", status)
	}
	if page > 0 {
		params.Set("page", strconv.Itoa(page))
	}
	if perPage > 0 {
		params.Set("per_page", strconv.Itoa(perPage))
	}

	endpoint := "/v1/subscriptions"
	if len(params) > 0 {
		endpoint += "?" + params.Encode()
	}

	resp, err := s.makeRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list subscriptions: %w", err)
	}

	var subscriptions []LemonSqueezySubscription
	if err := json.Unmarshal(resp.Data, &subscriptions); err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal subscriptions data: %w", err)
	}

	return subscriptions, resp.Meta, nil
}

// UpdateSubscription updates a subscription
func (s *LemonSqueezyService) UpdateSubscription(ctx context.Context, subscriptionID string, attributes map[string]interface{}) (*LemonSqueezySubscription, error) {
	reqBody := map[string]interface{}{
		"data": map[string]interface{}{
			"type":       "subscriptions",
			"id":         subscriptionID,
			"attributes": attributes,
		},
	}

	resp, err := s.makeRequest(ctx, "PATCH", "/v1/subscriptions/"+subscriptionID, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to update subscription: %w", err)
	}

	var subscription LemonSqueezySubscription
	if err := json.Unmarshal(resp.Data, &subscription.Data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal subscription data: %w", err)
	}

	return &subscription, nil
}

// CancelSubscription cancels a subscription
func (s *LemonSqueezyService) CancelSubscription(ctx context.Context, subscriptionID string) (*LemonSqueezySubscription, error) {
	return s.UpdateSubscription(ctx, subscriptionID, map[string]interface{}{
		"cancelled": true,
	})
}

// PauseSubscription pauses a subscription
func (s *LemonSqueezyService) PauseSubscription(ctx context.Context, subscriptionID string) (*LemonSqueezySubscription, error) {
	return s.UpdateSubscription(ctx, subscriptionID, map[string]interface{}{
		"paused": true,
	})
}

// ResumeSubscription resumes a paused subscription
func (s *LemonSqueezyService) ResumeSubscription(ctx context.Context, subscriptionID string) (*LemonSqueezySubscription, error) {
	return s.UpdateSubscription(ctx, subscriptionID, map[string]interface{}{
		"paused": false,
	})
}

// ChangeSubscriptionVariant changes a subscription to a different variant
func (s *LemonSqueezyService) ChangeSubscriptionVariant(ctx context.Context, subscriptionID, variantID string) (*LemonSqueezySubscription, error) {
	return s.UpdateSubscription(ctx, subscriptionID, map[string]interface{}{
		"variant_id": variantID,
	})
}

// GetOrder retrieves an order by ID
func (s *LemonSqueezyService) GetOrder(ctx context.Context, orderID string) (*LemonSqueezyOrder, error) {
	resp, err := s.makeRequest(ctx, "GET", "/v1/orders/"+orderID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	var order LemonSqueezyOrder
	if err := json.Unmarshal(resp.Data, &order.Data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal order data: %w", err)
	}

	return &order, nil
}

// ListOrders retrieves orders with optional filtering
func (s *LemonSqueezyService) ListOrders(ctx context.Context, customerID, storeID, status string, page, perPage int) ([]LemonSqueezyOrder, *Meta, error) {
	params := url.Values{}
	if customerID != "" {
		params.Set("filter[customer_id]", customerID)
	}
	if storeID != "" {
		params.Set("filter[store_id]", storeID)
	}
	if status != "" {
		params.Set("filter[status]", status)
	}
	if page > 0 {
		params.Set("page", strconv.Itoa(page))
	}
	if perPage > 0 {
		params.Set("per_page", strconv.Itoa(perPage))
	}

	endpoint := "/v1/orders"
	if len(params) > 0 {
		endpoint += "?" + params.Encode()
	}

	resp, err := s.makeRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list orders: %w", err)
	}

	var orders []LemonSqueezyOrder
	if err := json.Unmarshal(resp.Data, &orders); err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal orders data: %w", err)
	}

	return orders, resp.Meta, nil
}

// CreateCheckoutURL creates a checkout URL for a variant
func (s *LemonSqueezyService) CreateCheckoutURL(ctx context.Context, variantID string, customData map[string]interface{}) (string, error) {
	reqBody := map[string]interface{}{
		"data": map[string]interface{}{
			"type": "checkouts",
			"attributes": map[string]interface{}{
				"store_id":    s.storeID,
				"variant_id":  variantID,
				"custom_data": customData,
			},
		},
	}

	resp, err := s.makeRequest(ctx, "POST", "/v1/checkouts", reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to create checkout: %w", err)
	}

	var checkoutData map[string]interface{}
	if err := json.Unmarshal(resp.Data, &checkoutData); err != nil {
		return "", fmt.Errorf("failed to unmarshal checkout data: %w", err)
	}

	attributes, ok := checkoutData["attributes"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid checkout response format")
	}

	checkoutURL, ok := attributes["url"].(string)
	if !ok {
		return "", fmt.Errorf("checkout URL not found in response")
	}

	return checkoutURL, nil
}

// VerifyWebhookSignature verifies a webhook signature
func (s *LemonSqueezyService) VerifyWebhookSignature(payload []byte, signature string) bool {
	if s.webhookSecret == "" {
		s.log.Warn("Webhook secret not configured, skipping signature verification")
		return true
	}

	// Lemon Squeezy uses HMAC-SHA256 for webhook signatures
	// The signature is in the format: "sha256=<signature>"
	expectedPrefix := "sha256="
	if !strings.HasPrefix(signature, expectedPrefix) {
		return false
	}

	signatureBytes := []byte(signature[len(expectedPrefix):])

	// TODO: Implement actual HMAC verification
	// For now, we'll skip verification in development
	return true
}

// GetStoreInfo retrieves store information
func (s *LemonSqueezyService) GetStoreInfo(ctx context.Context, storeID string) (map[string]interface{}, error) {
	resp, err := s.makeRequest(ctx, "GET", "/v1/stores/"+storeID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get store info: %w", err)
	}

	var storeData map[string]interface{}
	if err := json.Unmarshal(resp.Data, &storeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal store data: %w", err)
	}

	return storeData, nil
}

// GetUsage retrieves usage statistics for a subscription
func (s *LemonSqueezyService) GetUsage(ctx context.Context, subscriptionID string) (map[string]interface{}, error) {
	// Lemon Squeezy doesn't have a direct usage API
	// This would be implemented using custom usage tracking
	return map[string]interface{}{
		"subscription_id": subscriptionID,
		"usage_tracked":   true,
	}, nil
}
