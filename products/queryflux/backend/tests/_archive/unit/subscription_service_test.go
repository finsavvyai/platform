package services

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/lemonsqueezy"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap/zaptest"
)

// Mock repositories
type MockSubscriptionRepository struct {
	mock.Mock
}

func (m *MockSubscriptionRepository) Create(ctx context.Context, subscription *entities.Subscription) error {
	args := m.Called(ctx, subscription)
	return args.Error(0)
}

func (m *MockSubscriptionRepository) GetByID(ctx context.Context, id string) (*entities.Subscription, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*entities.Subscription), args.Error(1)
}

func (m *MockSubscriptionRepository) GetByUserID(ctx context.Context, userID string) (*entities.Subscription, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.Subscription), args.Error(1)
}

func (m *MockSubscriptionRepository) GetByCustomerID(ctx context.Context, customerID string) (*entities.Subscription, error) {
	args := m.Called(ctx, customerID)
	return args.Get(0).(*entities.Subscription), args.Error(1)
}

func (m *MockSubscriptionRepository) GetByLemonSqueezyID(ctx context.Context, lemonSqueezyID string) (*entities.Subscription, error) {
	args := m.Called(ctx, lemonSqueezyID)
	return args.Get(0).(*entities.Subscription), args.Error(1)
}

func (m *MockSubscriptionRepository) Update(ctx context.Context, subscription *entities.Subscription) error {
	args := m.Called(ctx, subscription)
	return args.Error(0)
}

func (m *MockSubscriptionRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockSubscriptionRepository) UpdateStatus(ctx context.Context, id, status string) error {
	args := m.Called(ctx, id, status)
	return args.Error(0)
}

func (m *MockSubscriptionRepository) IncrementUsage(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockSubscriptionRepository) ResetUsage(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockSubscriptionRepository) GetActiveSubscriptions(ctx context.Context) ([]*entities.Subscription, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*entities.Subscription), args.Error(1)
}

func (m *MockSubscriptionRepository) GetExpiringSubscriptions(ctx context.Context, days int) ([]*entities.Subscription, error) {
	args := m.Called(ctx, days)
	return args.Get(0).([]*entities.Subscription), args.Error(1)
}

func (m *MockSubscriptionRepository) ListByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Subscription, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*entities.Subscription), args.Error(1)
}

func (m *MockSubscriptionRepository) CountByUser(ctx context.Context, userID string) (int, error) {
	args := m.Called(ctx, userID)
	return args.Int(0), args.Error(1)
}

type MockCustomerRepository struct {
	mock.Mock
}

func (m *MockCustomerRepository) Create(ctx context.Context, customer *entities.Customer) error {
	args := m.Called(ctx, customer)
	return args.Error(0)
}

func (m *MockCustomerRepository) GetByID(ctx context.Context, id string) (*entities.Customer, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*entities.Customer), args.Error(1)
}

func (m *MockCustomerRepository) GetByUserID(ctx context.Context, userID string) (*entities.Customer, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.Customer), args.Error(1)
}

func (m *MockCustomerRepository) GetByLemonSqueezyID(ctx context.Context, lemonSqueezyID string) (*entities.Customer, error) {
	args := m.Called(ctx, lemonSqueezyID)
	return args.Get(0).(*entities.Customer), args.Error(1)
}

func (m *MockCustomerRepository) Update(ctx context.Context, customer *entities.Customer) error {
	args := m.Called(ctx, customer)
	return args.Error(0)
}

func (m *MockCustomerRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockCustomerRepository) GetByEmail(ctx context.Context, email string) (*entities.Customer, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(*entities.Customer), args.Error(1)
}

func (m *MockCustomerRepository) ListByStore(ctx context.Context, storeID string, limit, offset int) ([]*entities.Customer, error) {
	args := m.Called(ctx, storeID, limit, offset)
	return args.Get(0).([]*entities.Customer), args.Error(1)
}

type MockInvoiceRepository struct {
	mock.Mock
}

func (m *MockInvoiceRepository) Create(ctx context.Context, invoice *entities.Invoice) error {
	args := m.Called(ctx, invoice)
	return args.Error(0)
}

func (m *MockInvoiceRepository) GetByID(ctx context.Context, id string) (*entities.Invoice, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*entities.Invoice), args.Error(1)
}

func (m *MockInvoiceRepository) GetByInvoiceNumber(ctx context.Context, invoiceNumber string) (*entities.Invoice, error) {
	args := m.Called(ctx, invoiceNumber)
	return args.Get(0).(*entities.Invoice), args.Error(1)
}

func (m *MockInvoiceRepository) GetByLemonSqueezyID(ctx context.Context, lemonSqueezyID string) (*entities.Invoice, error) {
	args := m.Called(ctx, lemonSqueezyID)
	return args.Get(0).(*entities.Invoice), args.Error(1)
}

func (m *MockInvoiceRepository) Update(ctx context.Context, invoice *entities.Invoice) error {
	args := m.Called(ctx, invoice)
	return args.Error(0)
}

func (m *MockInvoiceRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockInvoiceRepository) ListByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Invoice, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*entities.Invoice), args.Error(1)
}

func (m *MockInvoiceRepository) ListBySubscription(ctx context.Context, subscriptionID string, limit, offset int) ([]*entities.Invoice, error) {
	args := m.Called(ctx, subscriptionID, limit, offset)
	return args.Get(0).([]*entities.Invoice), args.Error(1)
}

func (m *MockInvoiceRepository) ListByStatus(ctx context.Context, status string, limit, offset int) ([]*entities.Invoice, error) {
	args := m.Called(ctx, status, limit, offset)
	return args.Get(0).([]*entities.Invoice), args.Error(1)
}

func (m *MockInvoiceRepository) ListOverdue(ctx context.Context, days int) ([]*entities.Invoice, error) {
	args := m.Called(ctx, days)
	return args.Get(0).([]*entities.Invoice), args.Error(1)
}

func (m *MockInvoiceRepository) GetTotalRevenue(ctx context.Context, startDate, endDate time.Time) (float64, error) {
	args := m.Called(ctx, startDate, endDate)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockInvoiceRepository) GetRevenueByPlan(ctx context.Context, startDate, endDate time.Time) (map[string]float64, error) {
	args := m.Called(ctx, startDate, endDate)
	return args.Get(0).(map[string]float64), args.Error(1)
}

func (m *MockInvoiceRepository) CountByStatus(ctx context.Context, status string) (int, error) {
	args := m.Called(ctx, status)
	return args.Int(0), args.Error(1)
}

// Mock Lemon Squeezy client
type MockLemonSqueezyClient struct {
	mock.Mock
}

func (m *MockLemonSqueezyClient) CreateCheckout(ctx context.Context, req *lemonsqueezy.CreateCheckoutRequest) (*lemonsqueezy.CheckoutResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*lemonsqueezy.CheckoutResponse), args.Error(1)
}

func (m *MockLemonSqueezyClient) CancelSubscription(ctx context.Context, subscriptionID string) error {
	args := m.Called(ctx, subscriptionID)
	return args.Error(0)
}

func (m *MockLemonSqueezyClient) CreateCustomer(ctx context.Context, email, name, storeID string) (*lemonsqueezy.CustomerResponse, error) {
	args := m.Called(ctx, email, name, storeID)
	return args.Get(0).(*lemonsqueezy.CustomerResponse), args.Error(1)
}

// Test functions

func TestSubscriptionService_GetSubscription(t *testing.T) {
	ctx := context.Background()
	logger := zaptest.NewLogger(t)

	// Setup mocks
	subscriptionRepo := &MockSubscriptionRepository{}
	customerRepo := &MockCustomerRepository{}
	invoiceRepo := &MockInvoiceRepository{}
	lsClient := &MockLemonSqueezyClient{}

	service := services.NewSubscriptionService(subscriptionRepo, customerRepo, invoiceRepo, lsClient, logger)

	// Test data
	userID := uuid.New().String()
	subscription := &entities.Subscription{
		ID:     uuid.New().String(),
		UserID: userID,
		Status: entities.SubscriptionStatusActive,
	}

	// Setup expectations
	subscriptionRepo.On("GetByUserID", ctx, userID).Return(subscription, nil)

	// Execute
	result, err := service.GetSubscription(ctx, userID)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, subscription, result)
	subscriptionRepo.AssertExpectations(t)
}

func TestSubscriptionService_CancelSubscription(t *testing.T) {
	ctx := context.Background()
	logger := zaptest.NewLogger(t)

	// Setup mocks
	subscriptionRepo := &MockSubscriptionRepository{}
	customerRepo := &MockCustomerRepository{}
	invoiceRepo := &MockInvoiceRepository{}
	lsClient := &MockLemonSqueezyClient{}

	service := services.NewSubscriptionService(subscriptionRepo, customerRepo, invoiceRepo, lsClient, logger)

	// Test data
	userID := uuid.New().String()
	subscription := &entities.Subscription{
		ID:         uuid.New().String(),
		UserID:     userID,
		Status:     entities.SubscriptionStatusActive,
		CustomerID: "cust_123",
	}
	reason := "Too expensive"

	// Setup expectations
	subscriptionRepo.On("GetByUserID", ctx, userID).Return(subscription, nil)
	lsClient.On("CancelSubscription", ctx, subscription.CustomerID).Return(nil)
	subscriptionRepo.On("Update", ctx, mock.AnythingOfType("*entities.Subscription")).Return(nil)

	// Execute
	err := service.CancelSubscription(ctx, userID, reason)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, entities.SubscriptionStatusCancelled, subscription.Status)
	assert.Equal(t, &reason, subscription.CancellationReason)
	subscriptionRepo.AssertExpectations(t)
	lsClient.AssertExpectations(t)
}

func TestSubscriptionService_CancelSubscription_NotActive(t *testing.T) {
	ctx := context.Background()
	logger := zaptest.NewLogger(t)

	// Setup mocks
	subscriptionRepo := &MockSubscriptionRepository{}
	customerRepo := &MockCustomerRepository{}
	invoiceRepo := &MockInvoiceRepository{}
	lsClient := &MockLemonSqueezyClient{}

	service := services.NewSubscriptionService(subscriptionRepo, customerRepo, invoiceRepo, lsClient, logger)

	// Test data
	userID := uuid.New().String()
	subscription := &entities.Subscription{
		ID:     uuid.New().String(),
		UserID: userID,
		Status: entities.SubscriptionStatusCancelled,
	}
	reason := "Too expensive"

	// Setup expectations
	subscriptionRepo.On("GetByUserID", ctx, userID).Return(subscription, nil)

	// Execute
	err := service.CancelSubscription(ctx, userID, reason)

	// Assert
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "subscription is not active")
	subscriptionRepo.AssertExpectations(t)
}

func TestSubscriptionService_CheckFeatureAccess_FreeUser(t *testing.T) {
	ctx := context.Background()
	logger := zaptest.NewLogger(t)

	// Setup mocks
	subscriptionRepo := &MockSubscriptionRepository{}
	customerRepo := &MockCustomerRepository{}
	invoiceRepo := &MockInvoiceRepository{}
	lsClient := &MockLemonSqueezyClient{}

	service := services.NewSubscriptionService(subscriptionRepo, customerRepo, invoiceRepo, lsClient, logger)

	// Test data
	userID := uuid.New().String()

	// Setup expectations - user has no subscription
	subscriptionRepo.On("GetByUserID", ctx, userID).Return(nil, fmt.Errorf("subscription not found"))

	// Test free features
	tests := []struct {
		feature  string
		expected bool
	}{
		{"basic_query_execution", true},
		{"connection_management", true},
		{"export_results", true},
		{"ai_optimization", false},
		{"unlimited_connections", false},
	}

	for _, test := range tests {
		hasAccess, err := service.CheckFeatureAccess(ctx, userID, test.feature)
		assert.NoError(t, err)
		assert.Equal(t, test.expected, hasAccess, "Feature: %s", test.feature)
	}

	subscriptionRepo.AssertExpectations(t)
}

func TestSubscriptionService_CheckFeatureAccess_PremiumUser(t *testing.T) {
	ctx := context.Background()
	logger := zaptest.NewLogger(t)

	// Setup mocks
	subscriptionRepo := &MockSubscriptionRepository{}
	customerRepo := &MockCustomerRepository{}
	invoiceRepo := &MockInvoiceRepository{}
	lsClient := &MockLemonSqueezyClient{}

	service := services.NewSubscriptionService(subscriptionRepo, customerRepo, invoiceRepo, lsClient, logger)

	// Test data
	userID := uuid.New().String()
	subscription := &entities.Subscription{
		ID:       uuid.New().String(),
		UserID:   userID,
		Status:   entities.SubscriptionStatusActive,
		PlanType: entities.PlanTypeMonthly,
	}

	// Setup expectations
	subscriptionRepo.On("GetByUserID", ctx, userID).Return(subscription, nil)

	// Test all features available for premium users
	tests := []struct {
		feature  string
		expected bool
	}{
		{"basic_query_execution", true},
		{"connection_management", true},
		{"export_results", true},
		{"ai_optimization", true},
		{"unlimited_connections", true},
	}

	for _, test := range tests {
		hasAccess, err := service.CheckFeatureAccess(ctx, userID, test.feature)
		assert.NoError(t, err)
		assert.Equal(t, test.expected, hasAccess, "Feature: %s", test.feature)
	}

	subscriptionRepo.AssertExpectations(t)
}

func TestSubscriptionService_CreateCheckout(t *testing.T) {
	ctx := context.Background()
	logger := zaptest.NewLogger(t)

	// Setup mocks
	subscriptionRepo := &MockSubscriptionRepository{}
	customerRepo := &MockCustomerRepository{}
	invoiceRepo := &MockInvoiceRepository{}
	lsClient := &MockLemonSqueezyClient{}

	service := services.NewSubscriptionService(subscriptionRepo, customerRepo, invoiceRepo, lsClient, logger)

	// Test data
	userID := uuid.New().String()
	email := "test@example.com"
	name := "Test User"
	storeID := "store_123"
	variantID := "variant_456"

	req := &services.CreateCheckoutRequest{
		UserID:    userID,
		Email:     email,
		Name:      name,
		StoreID:   storeID,
		VariantID: variantID,
	}

	customer := &entities.Customer{
		ID:      uuid.New().String(),
		UserID:  userID,
		Email:   email,
		Name:    name,
		StoreID: storeID,
	}

	checkoutResp := &lemonsqueezy.CheckoutResponse{
		Data: lemonsqueezy.CheckoutData{
			ID: "checkout_789",
			Attributes: lemonsqueezy.CheckoutDataAttributes{
				URL:       "https://lemonsqueezy.com/checkout/789",
				ExpiresAt: time.Now().Add(24 * time.Hour),
			},
		},
	}

	// Setup expectations - customer exists
	customerRepo.On("GetByUserID", ctx, userID).Return(customer, nil)
	lsClient.On("CreateCheckout", ctx, mock.AnythingOfType("*lemonsqueezy.CreateCheckoutRequest")).Return(checkoutResp, nil)

	// Execute
	result, err := service.CreateCheckout(ctx, req)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, checkoutResp.Data.Attributes.URL, result.CheckoutURL)
	customerRepo.AssertExpectations(t)
	lsClient.AssertExpectations(t)
}

func TestSubscriptionService_GetUsageStats(t *testing.T) {
	ctx := context.Background()
	logger := zaptest.NewLogger(t)

	// Setup mocks
	subscriptionRepo := &MockSubscriptionRepository{}
	customerRepo := &MockCustomerRepository{}
	invoiceRepo := &MockInvoiceRepository{}
	lsClient := &MockLemonSqueezyClient{}

	service := services.NewSubscriptionService(subscriptionRepo, customerRepo, invoiceRepo, lsClient, logger)

	// Test data
	userID := uuid.New().String()
	subscription := &entities.Subscription{
		ID:           uuid.New().String(),
		UserID:       userID,
		Status:       entities.SubscriptionStatusActive,
		UsageLimit:   1000,
		CurrentUsage: 250,
	}

	renewsAt := time.Now().Add(15 * 24 * time.Hour)
	subscription.RenewsAt = &renewsAt

	// Setup expectations
	subscriptionRepo.On("GetByUserID", ctx, userID).Return(subscription, nil)

	// Execute
	stats, err := service.GetUsageStats(ctx, userID)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, 250, stats.CurrentUsage)
	assert.Equal(t, 1000, stats.UsageLimit)
	assert.Equal(t, 750, stats.RemainingUsage)
	assert.Equal(t, 15, stats.DaysUntilRenewal)
	assert.False(t, stats.IsOverLimit)
	subscriptionRepo.AssertExpectations(t)
}