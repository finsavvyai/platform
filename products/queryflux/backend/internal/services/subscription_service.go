package services

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
	"github.com/queryflux/backend/internal/infrastructure/lemonsqueezy"
	"go.uber.org/zap"
)

// subscriptionService handles subscription business logic
type subscriptionService struct {
	subscriptionRepo repositories.SubscriptionRepository
	customerRepo     repositories.CustomerRepository
	invoiceRepo      repositories.InvoiceRepository
	lsClient         *lemonsqueezy.Client
	logger           *zap.Logger
}

// NewSubscriptionService creates a new subscription service
func NewSubscriptionService(
	subscriptionRepo repositories.SubscriptionRepository,
	customerRepo repositories.CustomerRepository,
	invoiceRepo repositories.InvoiceRepository,
	lsClient *lemonsqueezy.Client,
	logger *zap.Logger,
) SubscriptionService {
	return &subscriptionService{
		subscriptionRepo: subscriptionRepo,
		customerRepo:     customerRepo,
		invoiceRepo:      invoiceRepo,
		lsClient:         lsClient,
		logger:           logger,
	}
}

// CreateCheckout creates a checkout URL for a subscription
func (s *subscriptionService) CreateCheckout(ctx context.Context, req *CreateCheckoutRequest) (*SubscriptionCheckoutResponse, error) {
	// Get or create customer
	customer, err := s.getOrCreateCustomer(ctx, req.UserID, req.Email, req.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to get/create customer: %w", err)
	}
	s.logger.Debug("Acquired customer for checkout", zap.String("user_id", req.UserID), zap.String("customer_id", customer.ID))

	// Create Lemon Squeezy checkout
	lsReq := &lemonsqueezy.CreateCheckoutRequest{
		StoreID:       s.lsClient.GetStoreID(),
		VariantID:     req.VariantID,
		CustomerEmail: req.Email,
		CheckoutOptions: lemonsqueezy.CheckoutOptions{
			Custom: lemonsqueezy.CustomFields{},
		},
		CheckoutData: map[string]interface{}{
			"user_id": req.UserID,
		},
	}

	lsResp, err := s.lsClient.CreateCheckout(ctx, lsReq)
	if err != nil {
		return nil, fmt.Errorf("failed to create checkout: %w", err)
	}

	return &SubscriptionCheckoutResponse{
		CheckoutURL: lsResp.Data.Attributes.URL,
		ExpiresAt:   lsResp.Data.Attributes.ExpiresAt,
	}, nil
}

// GetUserSubscription retrieves the current subscription for a user
func (s *subscriptionService) GetUserSubscription(ctx context.Context, userID string) (*entities.Subscription, error) {
	sub, err := s.subscriptionRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("subscription not found: %w", err)
	}
	return sub, nil
}

// CancelSubscription cancels a user's subscription
func (s *subscriptionService) CancelSubscription(ctx context.Context, userID, reason string) error {
	sub, err := s.subscriptionRepo.GetByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("subscription not found: %w", err)
	}

	if !sub.IsActive() {
		return fmt.Errorf("subscription is not active")
	}

	// Cancel in Lemon Squeezy if it's a managed subscription
	if sub.LemonSqueezyID != "" {
		if err := s.lsClient.CancelSubscription(ctx, sub.LemonSqueezyID); err != nil {
			s.logger.Error("Failed to cancel Lemon Squeezy subscription", zap.String("sub_id", sub.LemonSqueezyID), zap.Error(err))
			return fmt.Errorf("failed to cancel subscription in Lemon Squeezy: %w", err)
		}
	}

	sub.Cancel(reason)
	if err := s.subscriptionRepo.Update(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription status: %w", err)
	}

	return nil
}

// PauseSubscription pauses a user's subscription
func (s *subscriptionService) PauseSubscription(ctx context.Context, userID string, resumeAt time.Time) error {
	sub, err := s.subscriptionRepo.GetByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("subscription not found: %w", err)
	}

	if !sub.IsActive() {
		return fmt.Errorf("subscription is not active")
	}

	if err := s.lsClient.PauseSubscription(ctx, sub.LemonSqueezyID, resumeAt); err != nil {
		return fmt.Errorf("failed to pause subscription in Lemon Squeezy: %w", err)
	}

	sub.Status = entities.SubscriptionStatusPaused
	if err := s.subscriptionRepo.Update(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription status: %w", err)
	}

	return nil
}

// ResumeSubscription resumes a paused subscription
func (s *subscriptionService) ResumeSubscription(ctx context.Context, userID string) error {
	sub, err := s.subscriptionRepo.GetByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("subscription not found: %w", err)
	}

	if sub.Status != entities.SubscriptionStatusPaused {
		return fmt.Errorf("subscription is not paused")
	}

	if err := s.lsClient.ResumeSubscription(ctx, sub.LemonSqueezyID); err != nil {
		return fmt.Errorf("failed to resume subscription in Lemon Squeezy: %w", err)
	}

	sub.Status = entities.SubscriptionStatusActive
	if err := s.subscriptionRepo.Update(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription status: %w", err)
	}

	return nil
}

// ChangePlan changes the user's subscription plan
func (s *subscriptionService) ChangePlan(ctx context.Context, userID, variantID string) error {
	sub, err := s.subscriptionRepo.GetByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("subscription not found: %w", err)
	}

	if !sub.CanUpgrade() {
		return fmt.Errorf("subscription cannot be upgraded")
	}

	if err := s.lsClient.ChangeSubscriptionVariant(ctx, sub.ID, variantID); err != nil {
		return fmt.Errorf("failed to change subscription variant in Lemon Squeezy: %w", err)
	}

	// Local update will typically happen via webhook, but we can set a pending state if needed
	return nil
}

// GetUserUsageStats retrieves usage statistics for a user
func (s *subscriptionService) GetUserUsageStats(ctx context.Context, userID string) (*UsageStats, error) {
	sub, err := s.subscriptionRepo.GetByUserID(ctx, userID)
	if err != nil {
		// Return default free tier stats if no subscription
		return &UsageStats{
			CurrentUsage:     0,
			UsageLimit:       100,
			RemainingUsage:   100,
			DaysUntilRenewal: 0,
			IsOverLimit:      false,
		}, nil
	}

	return &UsageStats{
		CurrentUsage:     sub.CurrentUsage,
		UsageLimit:       sub.UsageLimit,
		RemainingUsage:   sub.GetRemainingUsage(),
		DaysUntilRenewal: sub.GetDaysUntilRenewal(),
		IsOverLimit:      sub.UsageLimit > 0 && sub.CurrentUsage >= sub.UsageLimit,
	}, nil
}

// GetUserInvoices retrieves invoices for a user
func (s *subscriptionService) GetUserInvoices(ctx context.Context, userID string) ([]*entities.Invoice, error) {
	return s.invoiceRepo.ListByUser(ctx, userID, 50, 0)
}

// GetUserInvoice retrieves a specific invoice for a user
func (s *subscriptionService) GetUserInvoice(ctx context.Context, userID, invoiceID string) (*entities.Invoice, error) {
	invoice, err := s.invoiceRepo.GetByID(ctx, invoiceID)
	if err != nil {
		return nil, err
	}
	if invoice.UserID != userID {
		return nil, fmt.Errorf("unauthorized access to invoice")
	}
	return invoice, nil
}

// CheckFeatureAccess checks if a user has access to a specific feature
func (s *subscriptionService) CheckFeatureAccess(ctx context.Context, userID, feature string) (bool, error) {
	sub, err := s.subscriptionRepo.GetByUserID(ctx, userID)
	if err != nil {
		// Basic free tier features
		freeFeatures := map[string]bool{
			"basic_query": true,
		}
		return freeFeatures[feature], nil
	}

	if !sub.IsActive() {
		return false, nil
	}

	// In a real implementation, you would map plan types to features
	planFeatures := map[string]map[string]bool{
		entities.PlanTypeMonthly: {
			"basic_query":    true,
			"advanced_query": true,
		},
		entities.PlanTypeYearly: {
			"basic_query":    true,
			"advanced_query": true,
			"ai_features":    true,
		},
		entities.PlanTypeLifetime: {
			"basic_query":      true,
			"advanced_query":   true,
			"ai_features":      true,
			"priority_support": true,
		},
	}

	if features, ok := planFeatures[sub.PlanType]; ok {
		return features[feature], nil
	}

	return false, nil
}

// Helper methods

func (s *subscriptionService) getOrCreateCustomer(ctx context.Context, userID, email, name string) (*entities.Customer, error) {
	customer, err := s.customerRepo.GetByUserID(ctx, userID)
	if err == nil {
		return customer, nil
	}

	// Create new customer
	customer, err = entities.NewCustomer(userID, email, name, s.lsClient.GetStoreID())
	if err != nil {
		return nil, fmt.Errorf("failed to create customer: %w", err)
	}

	if err := s.customerRepo.Create(ctx, customer); err != nil {
		return nil, fmt.Errorf("failed to save customer: %w", err)
	}

	return customer, nil
}

type SubscriptionCheckoutResponse struct {
	CheckoutURL string    `json:"checkout_url"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type UsageStats struct {
	CurrentUsage     int  `json:"current_usage"`
	UsageLimit       int  `json:"usage_limit"`
	RemainingUsage   int  `json:"remaining_usage"`
	DaysUntilRenewal int  `json:"days_until_renewal"`
	IsOverLimit      bool `json:"is_over_limit"`
	// CustomData is a map of custom data fields
	CustomData map[string]interface{} `json:"custom_data"`
}

// CreateCheckoutRequest represents a checkout creation request
type CreateCheckoutRequest struct {
	VariantID string `json:"variant_id"`
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
}
