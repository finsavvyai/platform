//go:build legacy_migrated
// +build legacy_migrated

package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"quantumbeam/internal/billing/models"
	"quantumbeam/internal/billing/services"
	"quantumbeam/internal/middleware"
)

// BillingHandlers handles billing HTTP endpoints
type BillingHandlers struct {
	billingService *services.BillingService
}

// NewBillingHandlers creates new billing handlers
func NewBillingHandlers(billingService *services.BillingService) *BillingHandlers {
	return &BillingHandlers{
		billingService: billingService,
	}
}

// RegisterRoutes registers billing routes
func (h *BillingHandlers) RegisterRoutes(r *gin.RouterGroup) {
	billing := r.Group("/billing")
	{
		// Customer endpoints
		customers := billing.Group("/customers")
		{
			customers.POST("", h.CreateCustomer)
			customers.GET("/:id", h.GetCustomer)
			customers.GET("", h.ListCustomers)
			customers.GET("/:id/subscriptions", h.GetCustomerSubscriptions)
		}

		// Subscription endpoints
		subscriptions := billing.Group("/subscriptions")
		{
			subscriptions.POST("", h.CreateSubscription)
			subscriptions.GET("/:id", h.GetSubscription)
			subscriptions.PUT("/:id/cancel", h.CancelSubscription)
			subscriptions.GET("/:id/usage", h.GetSubscriptionUsage)
			subscriptions.GET("/:id/usage-records", h.GetUsageRecords)
		}

		// Usage endpoints
		usage := billing.Group("/usage")
		{
			usage.POST("/record", h.RecordUsage)
			usage.GET("/subscription/:id", h.GetSubscriptionUsage)
		}

		// Plan endpoints
		plans := billing.Group("/plans")
		{
			plans.GET("", h.GetPlans)
			plans.GET("/:id/variants", h.GetPlanVariants)
		}

		// Analytics endpoints
		analytics := billing.Group("/analytics")
		{
			analytics.GET("/dashboard", h.GetDashboardAnalytics)
			analytics.GET("/usage", h.GetUsageAnalytics)
		}

		// Webhook endpoints
		webhooks := billing.Group("/webhooks")
		{
			webhooks.POST("/lemon-squeezy", h.LemonSqueezyWebhook)
		}
	}
}

// Request/Response structures

type CreateCustomerRequest struct {
	Email   string `json:"email" binding:"required,email"`
	Name    string `json:"name" binding:"required"`
	Country string `json:"country" binding:"required"`
}

type CustomerResponse struct {
	ID             string                 `json:"id"`
	Email          string                 `json:"email"`
	Name           string                 `json:"name"`
	LemonSqueezyID string                 `json:"lemon_squeezy_id,omitempty"`
	Currency       string                 `json:"currency"`
	CreatedAt      time.Time              `json:"created_at"`
	Subscriptions  []SubscriptionResponse `json:"subscriptions,omitempty"`
}

type CreateSubscriptionRequest struct {
	CustomerID string `json:"customer_id" binding:"required"`
	VariantID  string `json:"variant_id" binding:"required"`
}

type SubscriptionResponse struct {
	ID              string            `json:"id"`
	CustomerID      string            `json:"customer_id"`
	PlanName        string            `json:"plan_name"`
	Status          string            `json:"status"`
	VariantID       string            `json:"variant_id"`
	Price           float64           `json:"price"`
	Currency        string            `json:"currency"`
	BillingCycle    string            `json:"billing_cycle"`
	StartedAt       time.Time         `json:"started_at"`
	EndsAt          *time.Time        `json:"ends_at,omitempty"`
	RenewsAt        *time.Time        `json:"renews_at,omitempty"`
	TrialEndsAt     *time.Time        `json:"trial_ends_at,omitempty"`
	UsageLimit      int               `json:"usage_limit"`
	UsageCurrent    int               `json:"usage_current"`
	UsagePercentage float64           `json:"usage_percentage"`
	Features        string            `json:"features,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	Customer        *CustomerResponse `json:"customer,omitempty"`
}

type RecordUsageRequest struct {
	SubscriptionID string `json:"subscription_id" binding:"required"`
	UsageType      string `json:"usage_type" binding:"required"`
	Quantity       int    `json:"quantity" binding:"required,min=1"`
	Description    string `json:"description"`
}

type UsageRecordResponse struct {
	ID          string    `json:"id"`
	UsageType   string    `json:"usage_type"`
	Quantity    int       `json:"quantity"`
	UnitPrice   float64   `json:"unit_price"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	Description string    `json:"description"`
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`
	CreatedAt   time.Time `json:"created_at"`
}

type UsageAnalyticsResponse struct {
	SubscriptionID  string         `json:"subscription_id"`
	CurrentUsage    int            `json:"current_usage"`
	UsageLimit      int            `json:"usage_limit"`
	UsagePercentage float64        `json:"usage_percentage"`
	PeriodUsage     map[string]int `json:"period_usage"`
	PeriodCost      float64        `json:"period_cost"`
	PeriodStart     time.Time      `json:"period_start"`
	PeriodEnd       time.Time      `json:"period_end"`
	Status          string         `json:"status"`
	BillingCycle    string         `json:"billing_cycle"`
	Price           float64        `json:"price"`
	Currency        string         `json:"currency"`
}

type DashboardAnalyticsResponse struct {
	TotalCustomers      int                    `json:"total_customers"`
	ActiveSubscriptions int                    `json:"active_subscriptions"`
	TotalRevenue        float64                `json:"total_revenue"`
	MonthlyRevenue      float64                `json:"monthly_revenue"`
	UsageStats          map[string]interface{} `json:"usage_stats"`
	SubscriptionStats   map[string]interface{} `json:"subscription_stats"`
}

// Customer endpoints

// CreateCustomer creates a new billing customer
func (h *BillingHandlers) CreateCustomer(c *gin.Context) {
	var req CreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	customer, err := h.billingService.CreateCustomer(c.Request.Context(), req.Email, req.Name, req.Country)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, h.customerToResponse(customer))
}

// GetCustomer retrieves a customer by ID
func (h *BillingHandlers) GetCustomer(c *gin.Context) {
	customerID := c.Param("id")

	customer, err := h.billingService.GetCustomer(c.Request.Context(), customerID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, h.customerToResponse(customer))
}

// ListCustomers retrieves a list of customers
func (h *BillingHandlers) ListCustomers(c *gin.Context) {
	// TODO: Implement pagination and filtering
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

// GetCustomerSubscriptions retrieves subscriptions for a customer
func (h *BillingHandlers) GetCustomerSubscriptions(c *gin.Context) {
	customerID := c.Param("id")

	subscriptions, err := h.billingService.GetCustomerSubscriptions(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := make([]SubscriptionResponse, len(subscriptions))
	for i, sub := range subscriptions {
		response[i] = h.subscriptionToResponse(&sub)
	}

	c.JSON(http.StatusOK, response)
}

// Subscription endpoints

// CreateSubscription creates a new subscription
func (h *BillingHandlers) CreateSubscription(c *gin.Context) {
	var req CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	subscription, err := h.billingService.CreateSubscription(c.Request.Context(), req.CustomerID, req.VariantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, h.subscriptionToResponse(subscription))
}

// GetSubscription retrieves a subscription by ID
func (h *BillingHandlers) GetSubscription(c *gin.Context) {
	subscriptionID := c.Param("id")

	subscription, err := h.billingService.GetSubscription(c.Request.Context(), subscriptionID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, h.subscriptionToResponse(subscription))
}

// CancelSubscription cancels a subscription
func (h *BillingHandlers) CancelSubscription(c *gin.Context) {
	subscriptionID := c.Param("id")

	if err := h.billingService.CancelSubscription(c.Request.Context(), subscriptionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subscription cancelled successfully"})
}

// GetSubscriptionUsage retrieves usage analytics for a subscription
func (h *BillingHandlers) GetSubscriptionUsage(c *gin.Context) {
	subscriptionID := c.Param("id")

	usage, err := h.billingService.GetSubscriptionUsage(c.Request.Context(), subscriptionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, usage)
}

// GetUsageRecords retrieves usage records for a subscription
func (h *BillingHandlers) GetUsageRecords(c *gin.Context) {
	subscriptionID := c.Param("id")

	// Parse optional date range
	var periodStart, periodEnd *time.Time
	if startStr := c.Query("start"); startStr != "" {
		if start, err := time.Parse(time.RFC3339, startStr); err == nil {
			periodStart = &start
		}
	}
	if endStr := c.Query("end"); endStr != "" {
		if end, err := time.Parse(time.RFC3339, endStr); err == nil {
			periodEnd = &end
		}
	}

	records, err := h.billingService.GetUsageRecords(c.Request.Context(), subscriptionID, periodStart, periodEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := make([]UsageRecordResponse, len(records))
	for i, record := range records {
		response[i] = UsageRecordResponse{
			ID:          record.ID,
			UsageType:   record.UsageType,
			Quantity:    record.Quantity,
			UnitPrice:   record.UnitPrice,
			Amount:      record.Amount,
			Currency:    record.Currency,
			Description: record.Description,
			PeriodStart: record.PeriodStart,
			PeriodEnd:   record.PeriodEnd,
			CreatedAt:   record.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, response)
}

// Usage endpoints

// RecordUsage records usage for a subscription
func (h *BillingHandlers) RecordUsage(c *gin.Context) {
	var req RecordUsageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.billingService.RecordUsage(
		c.Request.Context(),
		req.SubscriptionID,
		req.UsageType,
		req.Quantity,
		req.Description,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Usage recorded successfully"})
}

// Plan endpoints

// GetPlans retrieves available pricing plans
func (h *BillingHandlers) GetPlans(c *gin.Context) {
	// TODO: Implement plan retrieval
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

// GetPlanVariants retrieves variants for a plan
func (h *BillingHandlers) GetPlanVariants(c *gin.Context) {
	planID := c.Param("id")

	// TODO: Implement plan variant retrieval
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":   "Not implemented",
		"plan_id": planID,
	})
}

// Analytics endpoints

// GetDashboardAnalytics retrieves dashboard analytics
func (h *BillingHandlers) GetDashboardAnalytics(c *gin.Context) {
	// TODO: Implement dashboard analytics
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

// GetUsageAnalytics retrieves usage analytics
func (h *BillingHandlers) GetUsageAnalytics(c *gin.Context) {
	// TODO: Implement usage analytics
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

// Webhook endpoints

// LemonSqueezyWebhook handles Lemon Squeezy webhooks
func (h *BillingHandlers) LemonSqueezyWebhook(c *gin.Context) {
	// TODO: Implement webhook handling
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

// Middleware to check if user has active subscription
func (h *BillingHandlers) RequireActiveSubscription() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := middleware.GetUserID(c)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		// Get customer for user (assuming user_id == customer_id for now)
		hasActive, err := h.billingService.HasActiveSubscription(c.Request.Context(), userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check subscription"})
			c.Abort()
			return
		}

		if !hasActive {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Active subscription required",
				"code":  "SUBSCRIPTION_REQUIRED",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// Helper functions

func (h *BillingHandlers) customerToResponse(customer *models.Customer) CustomerResponse {
	return CustomerResponse{
		ID:             customer.ID,
		Email:          customer.Email,
		Name:           customer.Name,
		LemonSqueezyID: customer.LemonSqueezyID,
		Currency:       customer.Currency,
		CreatedAt:      customer.CreatedAt,
	}
}

func (h *BillingHandlers) subscriptionToResponse(subscription *models.Subscription) SubscriptionResponse {
	usagePercentage := 0.0
	if subscription.UsageLimit > 0 {
		usagePercentage = float64(subscription.UsageCurrent) / float64(subscription.UsageLimit) * 100
	}

	return SubscriptionResponse{
		ID:              subscription.ID,
		CustomerID:      subscription.CustomerID,
		PlanName:        subscription.PlanName,
		Status:          subscription.Status,
		VariantID:       subscription.VariantID,
		Price:           subscription.Price,
		Currency:        subscription.Currency,
		BillingCycle:    subscription.BillingCycle,
		StartedAt:       subscription.StartedAt,
		EndsAt:          subscription.EndsAt,
		RenewsAt:        subscription.RenewsAt,
		TrialEndsAt:     subscription.TrialEndsAt,
		UsageLimit:      subscription.UsageLimit,
		UsageCurrent:    subscription.UsageCurrent,
		UsagePercentage: usagePercentage,
		Features:        subscription.Features,
		CreatedAt:       subscription.CreatedAt,
	}
}

// Parse pagination parameters
func parsePaginationParams(c *gin.Context) (page, perPage int) {
	page = 1
	perPage = 20

	if p := c.Query("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}

	if p := c.Query("per_page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 && parsed <= 100 {
			perPage = parsed
		}
	}

	return page, perPage
}