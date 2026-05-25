package entities

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Subscription represents a user's subscription
type Subscription struct {
	ID                 string     `json:"id" db:"id"`
	UserID             string     `json:"user_id" db:"user_id"`
	CustomerID         string     `json:"customer_id" db:"customer_id"`
	StoreID            string     `json:"store_id" db:"store_id"`
	OrderID            string     `json:"order_id" db:"order_id"`
	ProductID          string     `json:"product_id" db:"product_id"`
	VariantID          string     `json:"variant_id" db:"variant_id"`
	LemonSqueezyID     string     `json:"lemonsqueezy_id" db:"lemonsqueezy_id"`
	PlanID             string     `json:"plan_id" db:"plan_id"`
	PlanName           string     `json:"plan_name" db:"plan_name"`
	Status             string     `json:"status" db:"status"`
	PlanType           string     `json:"plan_type" db:"plan_type"`
	TrialEndsAt        *time.Time `json:"trial_ends_at" db:"trial_ends_at"`
	RenewsAt           *time.Time `json:"renews_at" db:"renews_at"`
	EndsAt             *time.Time `json:"ends_at" db:"ends_at"`
	CurrentPeriodStart *time.Time `json:"current_period_start" db:"current_period_start"`
	CurrentPeriodEnd   *time.Time `json:"current_period_end" db:"current_period_end"`
	CancelledAt        *time.Time `json:"cancelled_at" db:"cancelled_at"`
	CancellationReason *string    `json:"cancellation_reason" db:"cancellation_reason"`
	UsageLimit         int        `json:"usage_limit" db:"usage_limit"`
	CurrentUsage       int        `json:"current_usage" db:"current_usage"`
	Features           JSONMap    `json:"features" db:"features"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at" db:"updated_at"`
}

// JSONMap is a map that can be marshaled/unmarshaled to JSON
type JSONMap map[string]interface{}

// SubscriptionStatus constants
const (
	SubscriptionStatusOnTrial   = "on_trial"
	SubscriptionStatusActive    = "active"
	SubscriptionStatusCancelled = "cancelled"
	SubscriptionStatusExpired   = "expired"
	SubscriptionStatusUnpaid    = "unpaid"
	SubscriptionStatusPaused    = "paused"
)

// PlanType constants
const (
	PlanTypeMonthly  = "monthly"
	PlanTypeYearly   = "yearly"
	PlanTypeLifetime = "lifetime"
)

// NewSubscription creates a new subscription
func NewSubscription(userID, customerID, storeID string) *Subscription {
	now := time.Now()
	return &Subscription{
		ID:         uuid.New().String(),
		UserID:     userID,
		CustomerID: customerID,
		StoreID:    storeID,
		Status:     SubscriptionStatusOnTrial,
		UsageLimit: 100, // Default free tier limit
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

// IsActive checks if the subscription is currently active
func (s *Subscription) IsActive() bool {
	switch s.Status {
	case SubscriptionStatusActive, SubscriptionStatusOnTrial:
		// Check if subscription has expired
		if s.EndsAt != nil && s.EndsAt.Before(time.Now()) {
			return false
		}
		return true
	default:
		return false
	}
}

// IsOnTrial checks if the subscription is in trial period
func (s *Subscription) IsOnTrial() bool {
	if s.Status != SubscriptionStatusOnTrial || s.TrialEndsAt == nil {
		return false
	}
	return s.TrialEndsAt.After(time.Now())
}

// CanUpgrade checks if the subscription can be upgraded
func (s *Subscription) CanUpgrade() bool {
	return s.IsActive() && s.Status != SubscriptionStatusCancelled
}

// IncrementUsage increments the current usage and checks limits
func (s *Subscription) IncrementUsage() error {
	s.CurrentUsage++
	s.UpdatedAt = time.Now()

	// Check if usage exceeds limit
	if s.UsageLimit > 0 && s.CurrentUsage > s.UsageLimit {
		return fmt.Errorf("usage limit exceeded: %d/%d", s.CurrentUsage, s.UsageLimit)
	}

	return nil
}

// UpdateStatus updates the subscription status
func (s *Subscription) UpdateStatus(status string) error {
	if !isValidSubscriptionStatus(status) {
		return fmt.Errorf("invalid subscription status: %s", status)
	}

	s.Status = status
	s.UpdatedAt = time.Now()

	if status == SubscriptionStatusCancelled {
		now := time.Now()
		s.CancelledAt = &now
	}

	return nil
}

// SetPlan sets the subscription plan
func (s *Subscription) SetPlan(planType string, usageLimit int) error {
	if !isValidPlanType(planType) {
		return fmt.Errorf("invalid plan type: %s", planType)
	}

	s.PlanType = planType
	s.UsageLimit = usageLimit
	s.UpdatedAt = time.Now()

	return nil
}

// ExtendSubscription extends the subscription renewal date
func (s *Subscription) ExtendSubscription(duration time.Duration) {
	if s.RenewsAt == nil {
		s.RenewsAt = &time.Time{}
		*s.RenewsAt = time.Now().Add(duration)
	} else {
		*s.RenewsAt = s.RenewsAt.Add(duration)
	}
	s.UpdatedAt = time.Now()
}

// Cancel cancels the subscription with a reason
func (s *Subscription) Cancel(reason string) {
	s.Status = SubscriptionStatusCancelled
	now := time.Now()
	s.CancelledAt = &now
	s.CancellationReason = &reason
	s.UpdatedAt = time.Now()

	// Set ends_at to current period end
	if s.RenewsAt != nil {
		s.EndsAt = s.RenewsAt
	}
}

// GetDaysUntilRenewal returns the number of days until renewal
func (s *Subscription) GetDaysUntilRenewal() int {
	if s.RenewsAt == nil {
		return -1
	}

	duration := time.Until(*s.RenewsAt)
	return int(duration.Hours() / 24)
}

// GetRemainingUsage returns the remaining usage for the current period
func (s *Subscription) GetRemainingUsage() int {
	if s.UsageLimit <= 0 {
		return -1 // Unlimited
	}

	remaining := s.UsageLimit - s.CurrentUsage
	if remaining < 0 {
		return 0
	}

	return remaining
}

// Helper functions
func isValidSubscriptionStatus(status string) bool {
	validStatuses := []string{
		SubscriptionStatusOnTrial,
		SubscriptionStatusActive,
		SubscriptionStatusCancelled,
		SubscriptionStatusExpired,
		SubscriptionStatusUnpaid,
		SubscriptionStatusPaused,
	}

	for _, valid := range validStatuses {
		if status == valid {
			return true
		}
	}

	return false
}

func isValidPlanType(planType string) bool {
	validTypes := []string{
		PlanTypeMonthly,
		PlanTypeYearly,
		PlanTypeLifetime,
	}

	for _, valid := range validTypes {
		if planType == valid {
			return true
		}
	}

	return false
}
