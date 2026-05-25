package models

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

// Subscription represents a customer subscription
type Subscription struct {
	ID             string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	CustomerID     string         `json:"customer_id" gorm:"not null;index"`
	PlanID         string         `json:"plan_id" gorm:"not null;index"`
	PlanName       string         `json:"plan_name" gorm:"not null"`
	Status         string         `json:"status" gorm:"not null;index"` // active, cancelled, paused, expired
	VariantID      string         `json:"variant_id" gorm:"not null"`
	Price          float64        `json:"price" gorm:"not null"`
	Currency       string         `json:"currency" gorm:"not null;default:'USD'"`
	BillingCycle   string         `json:"billing_cycle" gorm:"not null"` // monthly, yearly
	StartedAt      time.Time      `json:"started_at"`
	EndsAt         *time.Time     `json:"ends_at"`
	CancelledAt    *time.Time     `json:"cancelled_at"`
	PausedAt       *time.Time     `json:"paused_at"`
	TrialEndsAt    *time.Time     `json:"trial_ends_at"`
	RenewsAt       *time.Time     `json:"renews_at"`
	UsageLimit     int            `json:"usage_limit"`               // Monthly API call limit
	UsageCurrent   int            `json:"usage_current"`             // Current month usage
	Features       string         `json:"features" gorm:"type:text"` // JSON string of features
	LemonSqueezyID string         `json:"lemon_squeezy_id" gorm:"uniqueIndex"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Customer *Customer     `json:"customer,omitempty" gorm:"foreignKey:CustomerID"`
	Usage    []UsageRecord `json:"usage,omitempty" gorm:"foreignKey:SubscriptionID"`
	Invoices []Invoice     `json:"invoices,omitempty" gorm:"foreignKey:SubscriptionID"`
}

// Customer represents a billing customer
type Customer struct {
	ID             string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Email          string         `json:"email" gorm:"not null;uniqueIndex"`
	Name           string         `json:"name"`
	LemonSqueezyID string         `json:"lemon_squeezy_id" gorm:"uniqueIndex"`
	StripeID       *string        `json:"stripe_id,omitempty" gorm:"uniqueIndex"`
	Phone          *string        `json:"phone,omitempty"`
	Address        *Address       `json:"address,omitempty" gorm:"embedded"`
	TaxExempt      bool           `json:"tax_exempt" gorm:"default:false"`
	Balance        float64        `json:"balance" gorm:"default:0"`
	Currency       string         `json:"currency" gorm:"default:'USD'"`
	Locale         string         `json:"locale" gorm:"default:'en'"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Subscriptions []Subscription `json:"subscriptions,omitempty" gorm:"foreignKey:CustomerID"`
	UsageRecords  []UsageRecord  `json:"usage_records,omitempty" gorm:"foreignKey:CustomerID"`
}

// Address represents a customer address
type Address struct {
	Line1      string  `json:"line1"`
	Line2      *string `json:"line2,omitempty"`
	City       string  `json:"city"`
	State      string  `json:"state"`
	PostalCode string  `json:"postal_code"`
	Country    string  `json:"country"`
}

// UsageRecord tracks API usage for billing
type UsageRecord struct {
	ID             string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	CustomerID     string         `json:"customer_id" gorm:"not null;index"`
	SubscriptionID string         `json:"subscription_id" gorm:"not null;index"`
	UsageType      string         `json:"usage_type" gorm:"not null;index"` // api_call, quantum_circuit, storage
	Quantity       int            `json:"quantity" gorm:"not null"`
	UnitPrice      float64        `json:"unit_price"`
	Amount         float64        `json:"amount"`
	Currency       string         `json:"currency" gorm:"default:'USD'"`
	Description    string         `json:"description"`
	PeriodStart    time.Time      `json:"period_start"`
	PeriodEnd      time.Time      `json:"period_end"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Customer     *Customer     `json:"customer,omitempty" gorm:"foreignKey:CustomerID"`
	Subscription *Subscription `json:"subscription,omitempty" gorm:"foreignKey:SubscriptionID"`
}

// Invoice represents a billing invoice
type Invoice struct {
	ID              string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	CustomerID      string         `json:"customer_id" gorm:"not null;index"`
	SubscriptionID  string         `json:"subscription_id" gorm:"not null;index"`
	LemonSqueezyID  string         `json:"lemon_squeezy_id" gorm:"uniqueIndex"`
	Number          string         `json:"number" gorm:"not null;uniqueIndex"`
	Status          string         `json:"status" gorm:"not null;index"` // draft, pending, paid, void, refunded
	Currency        string         `json:"currency" gorm:"not null;default:'USD'"`
	Subtotal        float64        `json:"subtotal" gorm:"not null"`
	Tax             float64        `json:"tax" gorm:"default:0"`
	Total           float64        `json:"total" gorm:"not null"`
	AmountPaid      float64        `json:"amount_paid" gorm:"default:0"`
	AmountDue       float64        `json:"amount_due"`
	DueDate         *time.Time     `json:"due_date"`
	PaidAt          *time.Time     `json:"paid_at"`
	IssuedAt        time.Time      `json:"issued_at"`
	PeriodStart     *time.Time     `json:"period_start"`
	PeriodEnd       *time.Time     `json:"period_end"`
	Description     string         `json:"description"`
	LemonSqueezyURL *string        `json:"lemon_squeezy_url"`
	PaymentMethod   *string        `json:"payment_method"`
	Metadata        string         `json:"metadata" gorm:"type:text"` // JSON string
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Customer     *Customer     `json:"customer,omitempty" gorm:"foreignKey:CustomerID"`
	Subscription *Subscription `json:"subscription,omitempty" gorm:"foreignKey:SubscriptionID"`
	Items        []InvoiceItem `json:"items,omitempty" gorm:"foreignKey:InvoiceID"`
}

// InvoiceItem represents a line item in an invoice
type InvoiceItem struct {
	ID          string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	InvoiceID   string         `json:"invoice_id" gorm:"not null;index"`
	Description string         `json:"description" gorm:"not null"`
	Quantity    int            `json:"quantity" gorm:"not null"`
	UnitPrice   float64        `json:"unit_price" gorm:"not null"`
	Amount      float64        `json:"amount" gorm:"not null"`
	Currency    string         `json:"currency" gorm:"default:'USD'"`
	Period      *string        `json:"period,omitempty"` // For subscription items
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Invoice *Invoice `json:"invoice,omitempty" gorm:"foreignKey:InvoiceID"`
}

// PricingPlan represents a subscription plan
type PricingPlan struct {
	ID             string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name           string         `json:"name" gorm:"not null;uniqueIndex"`
	Description    string         `json:"description"`
	LemonSqueezyID string         `json:"lemon_squeezy_id" gorm:"uniqueIndex"`
	IsActive       bool           `json:"is_active" gorm:"default:true"`
	SortOrder      int            `json:"sort_order" gorm:"default:0"`
	Features       string         `json:"features" gorm:"type:text"`     // JSON string
	UsageLimits    string         `json:"usage_limits" gorm:"type:text"` // JSON string
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Variants []PlanVariant `json:"variants,omitempty" gorm:"foreignKey:PlanID"`
}

// PlanVariant represents a pricing variant for a plan
type PlanVariant struct {
	ID             string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	PlanID         string         `json:"plan_id" gorm:"not null;index"`
	Name           string         `json:"name" gorm:"not null"`
	LemonSqueezyID string         `json:"lemon_squeezy_id" gorm:"uniqueIndex"`
	BillingCycle   string         `json:"billing_cycle" gorm:"not null"` // monthly, yearly
	Price          float64        `json:"price" gorm:"not null"`
	Currency       string         `json:"currency" gorm:"default:'USD'"`
	TrialDays      int            `json:"trial_days" gorm:"default:0"`
	UsageLimit     int            `json:"usage_limit"`               // Monthly API call limit
	Features       string         `json:"features" gorm:"type:text"` // JSON string of additional features
	IsActive       bool           `json:"is_active" gorm:"default:true"`
	SortOrder      int            `json:"sort_order" gorm:"default:0"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Plan *PricingPlan `json:"plan,omitempty" gorm:"foreignKey:PlanID"`
}

// UsageAnalytics tracks usage analytics for reporting
type UsageAnalytics struct {
	ID               string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	CustomerID       string    `json:"customer_id" gorm:"not null;index"`
	SubscriptionID   string    `json:"subscription_id" gorm:"not null;index"`
	Period           time.Time `json:"period" gorm:"not null;index"` // YYYY-MM format
	TotalAPIcalls    int       `json:"total_api_calls"`
	QuantumCalls     int       `json:"quantum_calls"`
	ClassicalCalls   int       `json:"classical_calls"`
	StorageGB        float64   `json:"storage_gb"`
	QuantumAdvantage float64   `json:"quantum_advantage"` // Average quantum advantage score
	Cost             float64   `json:"cost"`
	Revenue          float64   `json:"revenue"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	// Relationships
	Customer     *Customer     `json:"customer,omitempty" gorm:"foreignKey:CustomerID"`
	Subscription *Subscription `json:"subscription,omitempty" gorm:"foreignKey:SubscriptionID"`
}

// BillingEvent represents billing-related events for webhooks
type BillingEvent struct {
	ID          string     `json:"id" gorm:"primaryKey;type:varchar(36)"`
	EventType   string     `json:"event_type" gorm:"not null;index"`
	WebhookID   string     `json:"webhook_id" gorm:"not null;index"`
	Processed   bool       `json:"processed" gorm:"default:false;index"`
	ProcessedAt *time.Time `json:"processed_at"`
	Data        string     `json:"data" gorm:"type:text"` // JSON string
	Error       *string    `json:"error,omitempty"`
	RetryCount  int        `json:"retry_count" gorm:"default:0"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// NewID generates a new UUID
func NewID() string {
	return uuid.New().String()
}

// TableName overrides for custom table names
func (Subscription) TableName() string {
	return "billing_subscriptions"
}

func (Customer) TableName() string {
	return "billing_customers"
}

func (UsageRecord) TableName() string {
	return "billing_usage_records"
}

func (Invoice) TableName() string {
	return "billing_invoices"
}

func (InvoiceItem) TableName() string {
	return "billing_invoice_items"
}

func (PricingPlan) TableName() string {
	return "billing_pricing_plans"
}

func (PlanVariant) TableName() string {
	return "billing_plan_variants"
}

func (UsageAnalytics) TableName() string {
	return "billing_usage_analytics"
}

func (BillingEvent) TableName() string {
	return "billing_events"
}
