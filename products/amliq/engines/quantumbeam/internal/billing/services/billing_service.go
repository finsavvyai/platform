package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"

	"quantumbeam.io/internal/billing/models"
	"quantumbeam.io/internal/config"
	"quantumbeam.io/internal/logger"
)

// BillingService handles billing operations
type BillingService struct {
	db           *gorm.DB
	lemonSqueezy *LemonSqueezyService
	log          logger.Logger
	config       config.BillingConfig
}

// NewBillingService creates a new billing service
func NewBillingService(db *gorm.DB, lemonConfig config.LemonSqueezyConfig, billingConfig config.BillingConfig, log logger.Logger) *BillingService {
	return &BillingService{
		db:           db,
		lemonSqueezy: NewLemonSqueezyService(lemonConfig, log),
		log:          log,
		config:       billingConfig,
	}
}

// CreateCustomer creates a new billing customer
func (s *BillingService) CreateCustomer(ctx context.Context, email, name, country string) (*models.Customer, error) {
	// Check if customer already exists
	var existingCustomer models.Customer
	if err := s.db.Where("email = ?", email).First(&existingCustomer).Error; err == nil {
		return &existingCustomer, nil
	}

	// Create customer in Lemon Squeezy
	lsCustomer, err := s.lemonSqueezy.CreateCustomer(ctx, email, name, country)
	if err != nil {
		s.log.Error("Failed to create customer in Lemon Squeezy", "error", err, "email", email)
		// Continue with local creation even if Lemon Squeezy fails
	}

	// Create local customer record
	customer := &models.Customer{
		ID:             models.NewID(),
		Email:          email,
		Name:           name,
		LemonSqueezyID: getStringValue(lsCustomer, "ID"),
		Currency:       "USD",
		Locale:         "en",
	}

	if lsCustomer != nil {
		if lsCustomer.Data.Attributes.EmailVerifiedAt != nil {
			// Customer is verified
		}
		if lsCustomer.Data.Attributes.StripeCustomerID != nil {
			customer.StripeID = lsCustomer.Data.Attributes.StripeCustomerID
		}
	}

	if err := s.db.Create(customer).Error; err != nil {
		return nil, fmt.Errorf("failed to create customer: %w", err)
	}

	s.log.Info("Created billing customer", "customer_id", customer.ID, "email", email)
	return customer, nil
}

// GetCustomer retrieves a customer by ID
func (s *BillingService) GetCustomer(ctx context.Context, customerID string) (*models.Customer, error) {
	var customer models.Customer
	if err := s.db.First(&customer, "id = ?", customerID).Error; err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}
	return &customer, nil
}

// GetCustomerByEmail retrieves a customer by email
func (s *BillingService) GetCustomerByEmail(ctx context.Context, email string) (*models.Customer, error) {
	var customer models.Customer
	if err := s.db.First(&customer, "email = ?", email).Error; err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}
	return &customer, nil
}

// CreateSubscription creates a new subscription
func (s *BillingService) CreateSubscription(ctx context.Context, customerID, variantID string) (*models.Subscription, error) {
	// Get customer
	customer, err := s.GetCustomer(ctx, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}

	// Get variant information
	variant, err := s.lemonSqueezy.GetVariant(ctx, variantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get variant: %w", err)
	}

	// Create checkout URL
	checkoutURL, err := s.lemonSqueezy.CreateCheckoutURL(ctx, variantID, map[string]interface{}{
		"customer_id": customerID,
		"created_at":  time.Now().Unix(),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create checkout URL: %w", err)
	}

	// Create subscription record (will be updated via webhook)
	subscription := &models.Subscription{
		ID:           models.NewID(),
		CustomerID:   customerID,
		PlanID:       fmt.Sprintf("plan_%s", variant.Data.Attributes.ProductID),
		PlanName:     variant.Data.Attributes.ProductName,
		Status:       "pending",
		VariantID:    variantID,
		Price:        variant.Data.Attributes.Price,
		Currency:     "USD",
		BillingCycle: variant.Data.Attributes.SubscriptionPeriod,
		StartedAt:    time.Now(),
		UsageLimit:   s.getDefaultUsageLimit(variant.Data.Attributes.Price),
		Features:     s.getDefaultFeatures(variant.Data.Attributes.Price),
	}

	if variant.Data.Attributes.TrialDays > 0 {
		trialEndsAt := time.Now().AddDate(0, 0, variant.Data.Attributes.TrialDays)
		subscription.TrialEndsAt = &trialEndsAt
	}

	if err := s.db.Create(subscription).Error; err != nil {
		return nil, fmt.Errorf("failed to create subscription: %w", err)
	}

	s.log.Info("Created subscription",
		"subscription_id", subscription.ID,
		"customer_id", customerID,
		"variant_id", variantID,
		"checkout_url", checkoutURL,
	)

	// Store checkout URL in metadata (in a real implementation, you'd return this)
	_ = checkoutURL

	return subscription, nil
}

// GetSubscription retrieves a subscription by ID
func (s *BillingService) GetSubscription(ctx context.Context, subscriptionID string) (*models.Subscription, error) {
	var subscription models.Subscription
	if err := s.db.Preload("Customer").First(&subscription, "id = ?", subscriptionID).Error; err != nil {
		return nil, fmt.Errorf("subscription not found: %w", err)
	}
	return &subscription, nil
}

// GetActiveSubscription retrieves the active subscription for a customer
func (s *BillingService) GetActiveSubscription(ctx context.Context, customerID string) (*models.Subscription, error) {
	var subscription models.Subscription
	if err := s.db.Preload("Customer").
		Where("customer_id = ? AND status IN ?", customerID, []string{"active", "trialing"}).
		First(&subscription).Error; err != nil {
		return nil, fmt.Errorf("no active subscription found: %w", err)
	}
	return &subscription, nil
}

// UpdateSubscriptionFromWebhook updates subscription from Lemon Squeezy webhook
func (s *BillingService) UpdateSubscriptionFromWebhook(ctx context.Context, lemonSqueezyID string, attributes map[string]interface{}) error {
	var subscription models.Subscription
	if err := s.db.Where("lemon_squeezy_id = ?", lemonSqueezyID).First(&subscription).Error; err != nil {
		// Subscription doesn't exist, create it
		return s.createSubscriptionFromWebhook(ctx, lemonSqueezyID, attributes)
	}

	// Update existing subscription
	return s.updateSubscriptionRecord(ctx, &subscription, attributes)
}

// createSubscriptionFromWebhook creates a subscription from webhook data
func (s *BillingService) createSubscriptionFromWebhook(ctx context.Context, lemonSqueezyID string, attributes map[string]interface{}) error {
	customerID, ok := attributes["customer_id"].(float64)
	if !ok {
		return fmt.Errorf("invalid customer_id in webhook")
	}

	variantID, ok := attributes["variant_id"].(float64)
	if !ok {
		return fmt.Errorf("invalid variant_id in webhook")
	}

	productName, _ := attributes["product_name"].(string)
	variantName, _ := attributes["variant_name"].(string)
	userEmail, _ := attributes["user_email"].(string)
	status, _ := attributes["status"].(string)
	billingCycle, _ := attributes["billing_cycle"].(string)

	price, _ := attributes["total"].(float64)
	currency, _ := attributes["currency"].(string)

	// Find or create customer
	var customer models.Customer
	if err := s.db.Where("email = ?", userEmail).First(&customer).Error; err != nil {
		// Create customer if not found
		customer = models.Customer{
			ID:             models.NewID(),
			Email:          userEmail,
			Name:           fmt.Sprintf("Customer %d", int64(customerID)),
			LemonSqueezyID: fmt.Sprintf("%.0f", customerID),
			Currency:       "USD",
		}
		if err := s.db.Create(&customer).Error; err != nil {
			return fmt.Errorf("failed to create customer from webhook: %w", err)
		}
	}

	subscription := &models.Subscription{
		ID:             models.NewID(),
		CustomerID:     customer.ID,
		PlanID:         fmt.Sprintf("plan_%.0f", customerID),
		PlanName:       productName,
		Status:         status,
		VariantID:      fmt.Sprintf("%.0f", variantID),
		Price:          price,
		Currency:       currency,
		BillingCycle:   billingCycle,
		LemonSqueezyID: lemonSqueezyID,
		StartedAt:      time.Now(),
		UsageLimit:     s.getDefaultUsageLimit(price),
		Features:       s.getDefaultFeatures(price),
	}

	// Handle dates
	if billedAt, ok := attributes["billed_at"].(string); ok {
		if parsedTime, err := time.Parse(time.RFC3339, billedAt); err == nil {
			subscription.StartedAt = parsedTime
		}
	}

	if renewsAt, ok := attributes["renews_at"].(string); ok {
		if parsedTime, err := time.Parse(time.RFC3339, renewsAt); err == nil {
			subscription.RenewsAt = &parsedTime
		}
	}

	if endsAt, ok := attributes["ends_at"].(string); ok {
		if parsedTime, err := time.Parse(time.RFC3339, endsAt); err == nil {
			subscription.EndsAt = &parsedTime
		}
	}

	if trialEndsAt, ok := attributes["trial_ends_at"].(string); ok {
		if parsedTime, err := time.Parse(time.RFC3339, trialEndsAt); err == nil {
			subscription.TrialEndsAt = &parsedTime
		}
	}

	return s.db.Create(subscription).Error
}

// updateSubscriptionRecord updates a subscription record
func (s *BillingService) updateSubscriptionRecord(ctx context.Context, subscription *models.Subscription, attributes map[string]interface{}) error {
	status, _ := attributes["status"].(string)

	if status != "" {
		subscription.Status = status
	}

	// Handle dates
	if renewsAt, ok := attributes["renews_at"].(string); ok {
		if parsedTime, err := time.Parse(time.RFC3339, renewsAt); err == nil {
			subscription.RenewsAt = &parsedTime
		}
	}

	if endsAt, ok := attributes["ends_at"].(string); ok {
		if parsedTime, err := time.Parse(time.RFC3339, endsAt); err == nil {
			subscription.EndsAt = &parsedTime
		}
	}

	if trialEndsAt, ok := attributes["trial_ends_at"].(string); ok {
		if parsedTime, err := time.Parse(time.RFC3339, trialEndsAt); err == nil {
			subscription.TrialEndsAt = &parsedTime
		}
	}

	// Handle status-specific updates
	now := time.Now()
	switch status {
	case "cancelled":
		subscription.CancelledAt = &now
	case "paused":
		subscription.PausedAt = &now
	case "active":
		if subscription.PausedAt != nil {
			subscription.PausedAt = nil
		}
	}

	return s.db.Save(subscription).Error
}

// CancelSubscription cancels a subscription
func (s *BillingService) CancelSubscription(ctx context.Context, subscriptionID string) error {
	subscription, err := s.GetSubscription(ctx, subscriptionID)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}

	// Cancel in Lemon Squeezy
	if subscription.LemonSqueezyID != "" {
		_, err := s.lemonSqueezy.CancelSubscription(ctx, subscription.LemonSqueezyID)
		if err != nil {
			s.log.Error("Failed to cancel subscription in Lemon Squeezy",
				"error", err,
				"subscription_id", subscriptionID,
				"lemon_squeezy_id", subscription.LemonSqueezyID,
			)
		}
	}

	// Update local record
	now := time.Now()
	subscription.Status = "cancelled"
	subscription.CancelledAt = &now

	if err := s.db.Save(subscription).Error; err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	s.log.Info("Cancelled subscription", "subscription_id", subscriptionID)
	return nil
}

// RecordUsage records usage for a subscription
func (s *BillingService) RecordUsage(ctx context.Context, subscriptionID, usageType string, quantity int, description string) error {
	subscription, err := s.GetSubscription(ctx, subscriptionID)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}

	// Check usage limits
	if subscription.UsageLimit > 0 && subscription.UsageCurrent+quantity > subscription.UsageLimit {
		return fmt.Errorf("usage limit exceeded: %d/%d", subscription.UsageCurrent+quantity, subscription.UsageLimit)
	}

	// Create usage record
	usageRecord := &models.UsageRecord{
		ID:             models.NewID(),
		CustomerID:     subscription.CustomerID,
		SubscriptionID: subscriptionID,
		UsageType:      usageType,
		Quantity:       quantity,
		UnitPrice:      s.getUnitPrice(usageType, subscription.Price),
		Amount:         float64(quantity) * s.getUnitPrice(usageType, subscription.Price),
		Currency:       subscription.Currency,
		Description:    description,
		PeriodStart:    time.Now().Truncate(time.Hour * 24),
		PeriodEnd:      time.Now().Truncate(time.Hour * 24).Add(time.Hour * 24),
	}

	if err := s.db.Create(usageRecord).Error; err != nil {
		return fmt.Errorf("failed to create usage record: %w", err)
	}

	// Update subscription usage
	subscription.UsageCurrent += quantity
	if err := s.db.Save(subscription).Error; err != nil {
		return fmt.Errorf("failed to update subscription usage: %w", err)
	}

	s.log.Info("Recorded usage",
		"subscription_id", subscriptionID,
		"usage_type", usageType,
		"quantity", quantity,
		"total_usage", subscription.UsageCurrent,
	)

	return nil
}

// GetUsageRecords retrieves usage records for a subscription
func (s *BillingService) GetUsageRecords(ctx context.Context, subscriptionID string, periodStart, periodEnd *time.Time) ([]models.UsageRecord, error) {
	var records []models.UsageRecord

	query := s.db.Where("subscription_id = ?", subscriptionID)

	if periodStart != nil {
		query = query.Where("period_start >= ?", *periodStart)
	}

	if periodEnd != nil {
		query = query.Where("period_end <= ?", *periodEnd)
	}

	if err := query.Order("created_at DESC").Find(&records).Error; err != nil {
		return nil, fmt.Errorf("failed to get usage records: %w", err)
	}

	return records, nil
}

// GetCustomerSubscriptions retrieves all subscriptions for a customer
func (s *BillingService) GetCustomerSubscriptions(ctx context.Context, customerID string) ([]models.Subscription, error) {
	var subscriptions []models.Subscription
	if err := s.db.Where("customer_id = ?", customerID).
		Order("created_at DESC").
		Find(&subscriptions).Error; err != nil {
		return nil, fmt.Errorf("failed to get customer subscriptions: %w", err)
	}
	return subscriptions, nil
}

// HasActiveSubscription checks if a customer has an active subscription
func (s *BillingService) HasActiveSubscription(ctx context.Context, customerID string) (bool, error) {
	var count int64
	if err := s.db.Model(&models.Subscription{}).
		Where("customer_id = ? AND status IN ?", customerID, []string{"active", "trialing"}).
		Count(&count).Error; err != nil {
		return false, fmt.Errorf("failed to check active subscription: %w", err)
	}
	return count > 0, nil
}

// GetSubscriptionUsage retrieves usage statistics for a subscription
func (s *BillingService) GetSubscriptionUsage(ctx context.Context, subscriptionID string) (map[string]interface{}, error) {
	subscription, err := s.GetSubscription(ctx, subscriptionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}

	// Get current month usage
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	monthEnd := monthStart.AddDate(0, 1, 0)

	var records []models.UsageRecord
	if err := s.db.Where("subscription_id = ? AND period_start >= ? AND period_end < ?",
		subscriptionID, monthStart, monthEnd).Find(&records).Error; err != nil {
		return nil, fmt.Errorf("failed to get usage records: %w", err)
	}

	// Aggregate usage by type
	usageByType := make(map[string]int)
	totalCost := 0.0

	for _, record := range records {
		usageByType[record.UsageType] += record.Quantity
		totalCost += record.Amount
	}

	return map[string]interface{}{
		"subscription_id":  subscriptionID,
		"current_usage":    subscription.UsageCurrent,
		"usage_limit":      subscription.UsageLimit,
		"usage_percentage": float64(subscription.UsageCurrent) / float64(subscription.UsageLimit) * 100,
		"period_usage":     usageByType,
		"period_cost":      totalCost,
		"period_start":     monthStart,
		"period_end":       monthEnd,
		"status":           subscription.Status,
		"billing_cycle":    subscription.BillingCycle,
		"price":            subscription.Price,
		"currency":         subscription.Currency,
	}, nil
}

// Helper functions

func getStringValue(lsCustomer *LemonSqueezyCustomer, field string) string {
	if lsCustomer == nil {
		return ""
	}

	switch field {
	case "ID":
		return lsCustomer.Data.ID
	default:
		return ""
	}
}

func (s *BillingService) getDefaultUsageLimit(price float64) int {
	// Define usage limits based on price tier
	if price < 10 {
		return 1000 // Basic tier
	} else if price < 50 {
		return 10000 // Pro tier
	} else if price < 100 {
		return 50000 // Business tier
	} else {
		return 100000 // Enterprise tier
	}
}

func (s *BillingService) getDefaultFeatures(price float64) string {
	features := map[string]interface{}{
		"api_access":         true,
		"quantum_processing": price >= 10,
		"advanced_analytics": price >= 50,
		"priority_support":   price >= 100,
		"custom_models":      price >= 100,
	}

	featuresJSON, _ := json.Marshal(features)
	return string(featuresJSON)
}

func (s *BillingService) getUnitPrice(usageType string, subscriptionPrice float64) float64 {
	// Define unit prices based on usage type and subscription tier
	switch usageType {
	case "api_call":
		if subscriptionPrice < 10 {
			return 0.001
		} else if subscriptionPrice < 50 {
			return 0.0005
		} else {
			return 0.0001
		}
	case "quantum_circuit":
		return 0.01
	case "storage":
		return 0.1 // per GB
	default:
		return 0.001
	}
}
