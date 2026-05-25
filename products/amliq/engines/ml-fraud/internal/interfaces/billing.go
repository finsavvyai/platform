package interfaces

import (
	"context"

	"quantumbeam/internal/models"
)

// BillingService defines the billing and subscription management interface
type BillingService interface {
	// Subscription Management
	CreateSubscription(ctx context.Context, customerID string, planID string) (*Subscription, error)
	GetSubscription(ctx context.Context, subscriptionID string) (*Subscription, error)
	UpdateSubscription(ctx context.Context, subscriptionID string, planID string) (*Subscription, error)
	CancelSubscription(ctx context.Context, subscriptionID string) error
	ReactivateSubscription(ctx context.Context, subscriptionID string) (*Subscription, error)
	ListSubscriptions(ctx context.Context, customerID string) ([]*Subscription, error)

	// Usage Tracking
	ProcessUsage(ctx context.Context, apiKeyID string, usage *UsageData) error
	GetUsageMetrics(ctx context.Context, customerID string, period *TimePeriod) (*UsageMetrics, error)
	GetBillingInfo(ctx context.Context, customerID string) (*BillingInfo, error)
	CalculateUsageCost(ctx context.Context, usage *UsageData, tier models.PricingTier) (*CostCalculation, error)

	// LemonSqueezy Integration
	HandleLemonSqueezyWebhook(ctx context.Context, webhook *LemonSqueezyWebhook) error
	SyncSubscriptionWithLemonSqueezy(ctx context.Context, subscriptionID string) (*Subscription, error)
	CreateLemonSqueezyCheckout(ctx context.Context, request *CheckoutRequest) (*CheckoutResponse, error)
	GetLemonSqueezyCustomer(ctx context.Context, customerID string) (*LemonSqueezyCustomer, error)

	// Invoice Management
	GenerateInvoice(ctx context.Context, subscriptionID string, period *TimePeriod) (*Invoice, error)
	GetInvoice(ctx context.Context, invoiceID string) (*Invoice, error)
	ListInvoices(ctx context.Context, customerID string) ([]*Invoice, error)
	MarkInvoicePaid(ctx context.Context, invoiceID string, paymentID string) error

	// Payment Processing
	ProcessPayment(ctx context.Context, paymentRequest *PaymentRequest) (*PaymentResult, error)
	RefundPayment(ctx context.Context, paymentID string, amount *float64) (*RefundResult, error)
	GetPaymentHistory(ctx context.Context, customerID string) ([]*Payment, error)
}

// UsageTrackingService defines usage tracking and analytics interface
type UsageTrackingService interface {
	// Real-time Usage Tracking
	RecordAPICall(ctx context.Context, apiKeyID string, endpoint string, processingMethod string) error
	RecordQuantumUsage(ctx context.Context, apiKeyID string, circuitComplexity int, executionTime int64) error
	RecordClassicalUsage(ctx context.Context, apiKeyID string, modelType string, executionTime int64) error

	// Usage Analytics
	GetUsageAnalytics(ctx context.Context, customerID string, period *TimePeriod) (*UsageAnalytics, error)
	GetAPIUsageBreakdown(ctx context.Context, apiKeyID string, period *TimePeriod) (*APIUsageBreakdown, error)
	GetCostProjection(ctx context.Context, customerID string, projectionPeriod int) (*CostProjection, error)

	// Usage Limits and Alerts
	CheckUsageLimit(ctx context.Context, apiKeyID string) (*UsageLimitStatus, error)
	SetUsageAlert(ctx context.Context, customerID string, alert *UsageAlert) error
	GetUsageAlerts(ctx context.Context, customerID string) ([]*UsageAlert, error)
	TriggerUsageAlert(ctx context.Context, alertID string, currentUsage *UsageData) error
}

// Supporting types for billing interfaces

// Subscription represents a customer subscription
type Subscription struct {
	ID                 string                 `json:"id"`
	CustomerID         string                 `json:"customer_id"`
	PlanID             string                 `json:"plan_id"`
	Status             SubscriptionStatus     `json:"status"`
	CurrentPeriodStart int64                  `json:"current_period_start"`
	CurrentPeriodEnd   int64                  `json:"current_period_end"`
	TrialEnd           *int64                 `json:"trial_end,omitempty"`
	CancelAt           *int64                 `json:"cancel_at,omitempty"`
	CanceledAt         *int64                 `json:"canceled_at,omitempty"`
	CreatedAt          int64                  `json:"created_at"`
	UpdatedAt          int64                  `json:"updated_at"`
	LemonSqueezyID     string                 `json:"lemonsqueezy_id"`
	Metadata           map[string]interface{} `json:"metadata"`
}

// SubscriptionStatus represents subscription status
type SubscriptionStatus string

const (
	SubscriptionStatusActive   SubscriptionStatus = "active"
	SubscriptionStatusTrialing SubscriptionStatus = "trialing"
	SubscriptionStatusPastDue  SubscriptionStatus = "past_due"
	SubscriptionStatusCanceled SubscriptionStatus = "canceled"
	SubscriptionStatusUnpaid   SubscriptionStatus = "unpaid"
)

// UsageData represents usage information
type UsageData struct {
	APIKeyID         string `json:"api_key_id"`
	Endpoint         string `json:"endpoint"`
	ProcessingMethod string `json:"processing_method"`
	RequestCount     int64  `json:"request_count"`
	ProcessingTime   int64  `json:"processing_time_ms"`
	DataVolume       int64  `json:"data_volume_bytes"`
	QuantumCircuits  int    `json:"quantum_circuits"`
	Timestamp        int64  `json:"timestamp"`
}

// TimePeriod represents a time period for analytics
type TimePeriod struct {
	StartTime int64 `json:"start_time"`
	EndTime   int64 `json:"end_time"`
}

// UsageMetrics represents usage metrics for a period
type UsageMetrics struct {
	CustomerID        string                    `json:"customer_id"`
	Period            *TimePeriod               `json:"period"`
	TotalRequests     int64                     `json:"total_requests"`
	QuantumRequests   int64                     `json:"quantum_requests"`
	ClassicalRequests int64                     `json:"classical_requests"`
	TotalCost         float64                   `json:"total_cost"`
	BreakdownByAPI    map[string]*APIUsageStats `json:"breakdown_by_api"`
	BreakdownByDay    map[string]*DailyUsage    `json:"breakdown_by_day"`
}

// APIUsageStats represents usage statistics for an API endpoint
type APIUsageStats struct {
	Endpoint       string  `json:"endpoint"`
	RequestCount   int64   `json:"request_count"`
	AverageLatency float64 `json:"average_latency_ms"`
	ErrorRate      float64 `json:"error_rate"`
	Cost           float64 `json:"cost"`
}

// DailyUsage represents daily usage statistics
type DailyUsage struct {
	Date              string  `json:"date"`
	RequestCount      int64   `json:"request_count"`
	QuantumRequests   int64   `json:"quantum_requests"`
	ClassicalRequests int64   `json:"classical_requests"`
	Cost              float64 `json:"cost"`
}

// BillingInfo represents billing information for a customer
type BillingInfo struct {
	CustomerID        string          `json:"customer_id"`
	CurrentPlan       *PricingPlan    `json:"current_plan"`
	CurrentUsage      *UsageMetrics   `json:"current_usage"`
	NextBillingDate   int64           `json:"next_billing_date"`
	OutstandingAmount float64         `json:"outstanding_amount"`
	PaymentMethod     *PaymentMethod  `json:"payment_method"`
	BillingAddress    *BillingAddress `json:"billing_address"`
	TaxInfo           *TaxInfo        `json:"tax_info"`
}

// PricingPlan represents a pricing plan
type PricingPlan struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Tier            models.PricingTier     `json:"tier"`
	Price           float64                `json:"price"`
	Currency        string                 `json:"currency"`
	BillingInterval string                 `json:"billing_interval"`
	Features        []string               `json:"features"`
	Limits          map[string]interface{} `json:"limits"`
	IsActive        bool                   `json:"is_active"`
}

// CostCalculation represents cost calculation result
type CostCalculation struct {
	BaseAmount       float64            `json:"base_amount"`
	UsageAmount      float64            `json:"usage_amount"`
	TotalAmount      float64            `json:"total_amount"`
	Currency         string             `json:"currency"`
	Breakdown        map[string]float64 `json:"breakdown"`
	AppliedDiscounts []Discount         `json:"applied_discounts"`
}

// Discount represents a billing discount
type Discount struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	Amount      float64 `json:"amount"`
	Percentage  float64 `json:"percentage"`
	Description string  `json:"description"`
}

// LemonSqueezyWebhook represents a LemonSqueezy webhook payload
type LemonSqueezyWebhook struct {
	EventName string                 `json:"event_name"`
	Data      map[string]interface{} `json:"data"`
	Meta      struct {
		EventName  string                 `json:"event_name"`
		CustomData map[string]interface{} `json:"custom_data"`
	} `json:"meta"`
}

// CheckoutRequest represents a checkout request
type CheckoutRequest struct {
	ProductID   string                 `json:"product_id"`
	CustomerID  string                 `json:"customer_id"`
	Email       string                 `json:"email"`
	CustomData  map[string]interface{} `json:"custom_data"`
	RedirectURL string                 `json:"redirect_url"`
}

// CheckoutResponse represents a checkout response
type CheckoutResponse struct {
	CheckoutURL string `json:"checkout_url"`
	CheckoutID  string `json:"checkout_id"`
}

// LemonSqueezyCustomer represents a LemonSqueezy customer
type LemonSqueezyCustomer struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// Invoice represents an invoice
type Invoice struct {
	ID             string                 `json:"id"`
	CustomerID     string                 `json:"customer_id"`
	SubscriptionID string                 `json:"subscription_id"`
	Number         string                 `json:"number"`
	Status         InvoiceStatus          `json:"status"`
	Amount         float64                `json:"amount"`
	Currency       string                 `json:"currency"`
	PeriodStart    int64                  `json:"period_start"`
	PeriodEnd      int64                  `json:"period_end"`
	DueDate        int64                  `json:"due_date"`
	PaidAt         *int64                 `json:"paid_at,omitempty"`
	CreatedAt      int64                  `json:"created_at"`
	LineItems      []InvoiceLineItem      `json:"line_items"`
	Metadata       map[string]interface{} `json:"metadata"`
}

// InvoiceStatus represents invoice status
type InvoiceStatus string

const (
	InvoiceStatusDraft         InvoiceStatus = "draft"
	InvoiceStatusOpen          InvoiceStatus = "open"
	InvoiceStatusPaid          InvoiceStatus = "paid"
	InvoiceStatusVoid          InvoiceStatus = "void"
	InvoiceStatusUncollectible InvoiceStatus = "uncollectible"
)

// InvoiceLineItem represents an invoice line item
type InvoiceLineItem struct {
	ID          string  `json:"id"`
	Description string  `json:"description"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	Amount      float64 `json:"amount"`
	Type        string  `json:"type"`
}

// PaymentRequest represents a payment request
type PaymentRequest struct {
	CustomerID    string                 `json:"customer_id"`
	Amount        float64                `json:"amount"`
	Currency      string                 `json:"currency"`
	PaymentMethod string                 `json:"payment_method"`
	Description   string                 `json:"description"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// PaymentResult represents a payment result
type PaymentResult struct {
	PaymentID     string        `json:"payment_id"`
	Status        PaymentStatus `json:"status"`
	Amount        float64       `json:"amount"`
	Currency      string        `json:"currency"`
	ProcessedAt   int64         `json:"processed_at"`
	TransactionID string        `json:"transaction_id"`
}

// PaymentStatus represents payment status
type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusSucceeded PaymentStatus = "succeeded"
	PaymentStatusFailed    PaymentStatus = "failed"
	PaymentStatusCanceled  PaymentStatus = "canceled"
)

// RefundResult represents a refund result
type RefundResult struct {
	RefundID    string  `json:"refund_id"`
	PaymentID   string  `json:"payment_id"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Status      string  `json:"status"`
	ProcessedAt int64   `json:"processed_at"`
}

// Payment represents a payment record
type Payment struct {
	ID            string                 `json:"id"`
	CustomerID    string                 `json:"customer_id"`
	Amount        float64                `json:"amount"`
	Currency      string                 `json:"currency"`
	Status        PaymentStatus          `json:"status"`
	PaymentMethod string                 `json:"payment_method"`
	Description   string                 `json:"description"`
	CreatedAt     int64                  `json:"created_at"`
	ProcessedAt   *int64                 `json:"processed_at,omitempty"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// PaymentMethod represents a payment method
type PaymentMethod struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Last4    string `json:"last4"`
	Brand    string `json:"brand"`
	ExpMonth int    `json:"exp_month"`
	ExpYear  int    `json:"exp_year"`
}

// BillingAddress represents a billing address
type BillingAddress struct {
	Line1      string `json:"line1"`
	Line2      string `json:"line2"`
	City       string `json:"city"`
	State      string `json:"state"`
	PostalCode string `json:"postal_code"`
	Country    string `json:"country"`
}

// TaxInfo represents tax information
type TaxInfo struct {
	TaxID     string  `json:"tax_id"`
	TaxRate   float64 `json:"tax_rate"`
	TaxAmount float64 `json:"tax_amount"`
	TaxType   string  `json:"tax_type"`
}

// UsageAnalytics represents usage analytics
type UsageAnalytics struct {
	CustomerID         string                 `json:"customer_id"`
	Period             *TimePeriod            `json:"period"`
	TotalCost          float64                `json:"total_cost"`
	CostTrend          []CostDataPoint        `json:"cost_trend"`
	UsageTrend         []UsageDataPoint       `json:"usage_trend"`
	TopEndpoints       []EndpointUsage        `json:"top_endpoints"`
	QuantumVsClassical *QuantumClassicalSplit `json:"quantum_vs_classical"`
}

// CostDataPoint represents a cost data point
type CostDataPoint struct {
	Timestamp int64   `json:"timestamp"`
	Cost      float64 `json:"cost"`
}

// UsageDataPoint represents a usage data point
type UsageDataPoint struct {
	Timestamp int64 `json:"timestamp"`
	Requests  int64 `json:"requests"`
}

// EndpointUsage represents endpoint usage statistics
type EndpointUsage struct {
	Endpoint     string  `json:"endpoint"`
	RequestCount int64   `json:"request_count"`
	Cost         float64 `json:"cost"`
	Percentage   float64 `json:"percentage"`
}

// QuantumClassicalSplit represents quantum vs classical usage split
type QuantumClassicalSplit struct {
	QuantumRequests   int64   `json:"quantum_requests"`
	ClassicalRequests int64   `json:"classical_requests"`
	QuantumCost       float64 `json:"quantum_cost"`
	ClassicalCost     float64 `json:"classical_cost"`
	QuantumPercentage float64 `json:"quantum_percentage"`
}

// APIUsageBreakdown represents API usage breakdown
type APIUsageBreakdown struct {
	APIKeyID      string                    `json:"api_key_id"`
	Period        *TimePeriod               `json:"period"`
	TotalRequests int64                     `json:"total_requests"`
	TotalCost     float64                   `json:"total_cost"`
	Endpoints     map[string]*APIUsageStats `json:"endpoints"`
	HourlyUsage   []HourlyUsageData         `json:"hourly_usage"`
}

// HourlyUsageData represents hourly usage data
type HourlyUsageData struct {
	Hour     int64   `json:"hour"`
	Requests int64   `json:"requests"`
	Cost     float64 `json:"cost"`
}

// CostProjection represents cost projection
type CostProjection struct {
	CustomerID       string             `json:"customer_id"`
	ProjectionPeriod int                `json:"projection_period_days"`
	CurrentCost      float64            `json:"current_cost"`
	ProjectedCost    float64            `json:"projected_cost"`
	Confidence       float64            `json:"confidence"`
	Factors          []ProjectionFactor `json:"factors"`
}

// ProjectionFactor represents a factor in cost projection
type ProjectionFactor struct {
	Name        string  `json:"name"`
	Impact      float64 `json:"impact"`
	Description string  `json:"description"`
}

// UsageLimitStatus represents usage limit status
type UsageLimitStatus struct {
	APIKeyID     string  `json:"api_key_id"`
	CurrentUsage int64   `json:"current_usage"`
	Limit        int64   `json:"limit"`
	Percentage   float64 `json:"percentage"`
	IsNearLimit  bool    `json:"is_near_limit"`
	IsOverLimit  bool    `json:"is_over_limit"`
	ResetTime    int64   `json:"reset_time"`
}

// UsageAlert represents a usage alert
type UsageAlert struct {
	ID            string         `json:"id"`
	CustomerID    string         `json:"customer_id"`
	Type          UsageAlertType `json:"type"`
	Threshold     float64        `json:"threshold"`
	IsActive      bool           `json:"is_active"`
	LastTriggered *int64         `json:"last_triggered,omitempty"`
	CreatedAt     int64          `json:"created_at"`
	UpdatedAt     int64          `json:"updated_at"`
}

// UsageAlertType represents usage alert type
type UsageAlertType string

const (
	UsageAlertTypeRequestCount UsageAlertType = "request_count"
	UsageAlertTypeCost         UsageAlertType = "cost"
	UsageAlertTypePercentage   UsageAlertType = "percentage"
)
