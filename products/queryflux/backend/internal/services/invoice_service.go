package services

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
	"go.uber.org/zap"
)

// InvoiceService handles invoice business logic
type InvoiceService struct {
	invoiceRepo      repositories.InvoiceRepository
	subscriptionRepo repositories.SubscriptionRepository
	logger           *zap.Logger
}

// NewInvoiceService creates a new invoice service
func NewInvoiceService(
	invoiceRepo repositories.InvoiceRepository,
	subscriptionRepo repositories.SubscriptionRepository,
	logger *zap.Logger,
) *InvoiceService {
	return &InvoiceService{
		invoiceRepo:      invoiceRepo,
		subscriptionRepo: subscriptionRepo,
		logger:           logger,
	}
}

// CreateInvoice creates a new invoice
func (s *InvoiceService) CreateInvoice(ctx context.Context, req *CreateInvoiceRequest) (*entities.Invoice, error) {
	// Create invoice
	invoice := entities.NewInvoice(req.UserID, req.Amount, req.Currency, req.Description)

	// Set subscription ID if provided
	if req.SubscriptionID != "" {
		invoice.SetSubscriptionID(req.SubscriptionID)
	}

	// Set due date if provided
	if req.DueDate != nil {
		invoice.SetDueDate(*req.DueDate)
	}

	// Update amounts with tax
	invoice.UpdateAmounts(req.Amount, req.TaxAmount)

	// Save to repository
	if err := s.invoiceRepo.Create(ctx, invoice); err != nil {
		return nil, fmt.Errorf("failed to create invoice: %w", err)
	}

	s.logger.Info("Invoice created",
		zap.String("invoice_id", invoice.ID),
		zap.String("user_id", invoice.UserID),
		zap.Float64("amount", invoice.TotalAmount),
	)

	return invoice, nil
}

// GetInvoice retrieves an invoice by ID
func (s *InvoiceService) GetInvoice(ctx context.Context, invoiceID, userID string) (*entities.Invoice, error) {
	invoice, err := s.invoiceRepo.GetByID(ctx, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get invoice: %w", err)
	}

	// Verify ownership
	if invoice.UserID != userID {
		return nil, fmt.Errorf("unauthorized: invoice does not belong to user")
	}

	return invoice, nil
}

// GetUserInvoices retrieves all invoices for a user
func (s *InvoiceService) GetUserInvoices(ctx context.Context, userID string, page, pageSize int) (*InvoiceListResponse, error) {
	// Calculate offset
	offset := (page - 1) * pageSize

	// Get invoices
	invoices, err := s.invoiceRepo.ListByUser(ctx, userID, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get invoices: %w", err)
	}

	// Get total count
	total, err := s.invoiceRepo.CountByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to count invoices: %w", err)
	}

	return &InvoiceListResponse{
		Invoices: invoices,
		Pagination: Pagination{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: (total + pageSize - 1) / pageSize,
		},
	}, nil
}

// MarkInvoiceAsPaid marks an invoice as paid
func (s *InvoiceService) MarkInvoiceAsPaid(ctx context.Context, invoiceID, lemonSqueezyID string) error {
	invoice, err := s.invoiceRepo.GetByID(ctx, invoiceID)
	if err != nil {
		return fmt.Errorf("failed to get invoice: %w", err)
	}

	// Update Lemon Squeezy ID if not set
	if invoice.LemonsqueezyID == "" {
		invoice.LemonsqueezyID = lemonSqueezyID
	}

	// Mark as paid
	invoice.MarkAsPaid()

	// Save changes
	if err := s.invoiceRepo.Update(ctx, invoice); err != nil {
		return fmt.Errorf("failed to update invoice: %w", err)
	}

	s.logger.Info("Invoice marked as paid",
		zap.String("invoice_id", invoiceID),
		zap.String("lemonsqueezy_id", lemonSqueezyID),
	)

	return nil
}

// ProcessRefund processes a refund for an invoice
func (s *InvoiceService) ProcessRefund(ctx context.Context, invoiceID string, refundAmount float64, reason string) error {
	invoice, err := s.invoiceRepo.GetByID(ctx, invoiceID)
	if err != nil {
		return fmt.Errorf("failed to get invoice: %w", err)
	}

	if invoice.Status != entities.InvoiceStatusPaid {
		return fmt.Errorf("invoice must be paid to process refund")
	}

	if refundAmount > invoice.TotalAmount {
		return fmt.Errorf("refund amount cannot exceed invoice total")
	}

	// Mark as refunded
	invoice.MarkAsRefunded(refundAmount)

	// Save changes
	if err := s.invoiceRepo.Update(ctx, invoice); err != nil {
		return fmt.Errorf("failed to update invoice: %w", err)
	}

	s.logger.Info("Invoice refunded",
		zap.String("invoice_id", invoiceID),
		zap.Float64("refund_amount", refundAmount),
		zap.String("reason", reason),
	)

	return nil
}

// GenerateInvoicesForSubscriptions generates invoices for active subscriptions
func (s *InvoiceService) GenerateInvoicesForSubscriptions(ctx context.Context) error {
	// Get all active subscriptions
	subscriptions, err := s.subscriptionRepo.GetActiveSubscriptions(ctx)
	if err != nil {
		return fmt.Errorf("failed to get active subscriptions: %w", err)
	}

	now := time.Now()
	for _, subscription := range subscriptions {
		// Check if subscription needs billing
		if subscription.RenewsAt != nil && subscription.RenewsAt.Before(now) {
			// Generate invoice based on plan
			amount, currency := s.getPlanPricing(subscription.PlanType)
			description := fmt.Sprintf("Subscription renewal - %s", subscription.PlanType)

			req := &CreateInvoiceRequest{
				UserID:         subscription.UserID,
				SubscriptionID: subscription.ID,
				Amount:         amount,
				Currency:       currency,
				Description:    description,
				DueDate:        &now,
			}

			invoice, err := s.CreateInvoice(ctx, req)
			if err != nil {
				s.logger.Error("Failed to generate invoice for subscription",
					zap.String("subscription_id", subscription.ID),
					zap.Error(err),
				)
				continue
			}

			// Update subscription renewal date
			subscription.ExtendSubscription(s.getBillingPeriod(subscription.PlanType))
			if err := s.subscriptionRepo.Update(ctx, subscription); err != nil {
				s.logger.Error("Failed to update subscription renewal date",
					zap.String("subscription_id", subscription.ID),
					zap.Error(err),
				)
			}

			s.logger.Info("Generated invoice for subscription renewal",
				zap.String("subscription_id", subscription.ID),
				zap.String("invoice_id", invoice.ID),
			)
		}
	}

	return nil
}

// GetRevenueReport generates a revenue report for a date range
func (s *InvoiceService) GetRevenueReport(ctx context.Context, startDate, endDate time.Time) (*RevenueReport, error) {
	// Get total revenue
	totalRevenue, err := s.invoiceRepo.GetTotalRevenue(ctx, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get total revenue: %w", err)
	}

	// Get revenue by plan
	revenueByPlan, err := s.invoiceRepo.GetRevenueByPlan(ctx, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get revenue by plan: %w", err)
	}

	return &RevenueReport{
		StartDate:     startDate,
		EndDate:       endDate,
		TotalRevenue:  totalRevenue,
		RevenueByPlan: revenueByPlan,
	}, nil
}

// GetOverdueInvoices retrieves all overdue invoices
func (s *InvoiceService) GetOverdueInvoices(ctx context.Context) ([]*entities.Invoice, error) {
	return s.invoiceRepo.ListOverdue(ctx, 0) // 0 days = all overdue
}

// Helper methods

func (s *InvoiceService) getPlanPricing(planType string) (float64, string) {
	pricing := map[string]struct {
		Amount   float64
		Currency string
	}{
		entities.PlanTypeMonthly:  {29.00, "USD"},
		entities.PlanTypeYearly:   {290.00, "USD"},
		entities.PlanTypeLifetime: {999.00, "USD"},
	}

	if pricing, exists := pricing[planType]; exists {
		return pricing.Amount, pricing.Currency
	}

	return 0.00, "USD"
}

func (s *InvoiceService) getBillingPeriod(planType string) time.Duration {
	switch planType {
	case entities.PlanTypeMonthly:
		return 30 * 24 * time.Hour // 30 days
	case entities.PlanTypeYearly:
		return 365 * 24 * time.Hour // 365 days
	case entities.PlanTypeLifetime:
		return 10 * 365 * 24 * time.Hour // 10 years
	default:
		return 30 * 24 * time.Hour
	}
}

// Request/Response types

type CreateInvoiceRequest struct {
	UserID         string     `json:"user_id"`
	SubscriptionID string     `json:"subscription_id,omitempty"`
	Amount         float64    `json:"amount"`
	Currency       string     `json:"currency"`
	Description    string     `json:"description"`
	DueDate        *time.Time `json:"due_date,omitempty"`
	TaxAmount      float64    `json:"tax_amount"`
}

type InvoiceListResponse struct {
	Invoices   []*entities.Invoice `json:"invoices"`
	Pagination Pagination          `json:"pagination"`
}

type Pagination struct {
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

type RevenueReport struct {
	StartDate     time.Time          `json:"start_date"`
	EndDate       time.Time          `json:"end_date"`
	TotalRevenue  float64            `json:"total_revenue"`
	RevenueByPlan map[string]float64 `json:"revenue_by_plan"`
}
