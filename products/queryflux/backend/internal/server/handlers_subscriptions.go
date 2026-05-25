package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/services"
	"go.uber.org/zap"
)

// SubscriptionHandlers handles subscription-related HTTP endpoints
type SubscriptionHandlers struct {
	subscriptionService services.SubscriptionService
	lemonSqueezyService *services.LemonSqueezyService
	webhookSecret       string
	logger              *zap.Logger
}

// NewSubscriptionHandlers creates new subscription handlers
func NewSubscriptionHandlers(
	subscriptionService services.SubscriptionService,
	lemonSqueezyService *services.LemonSqueezyService,
	webhookSecret string,
	logger *zap.Logger,
) *SubscriptionHandlers {
	return &SubscriptionHandlers{
		subscriptionService: subscriptionService,
		lemonSqueezyService: lemonSqueezyService,
		webhookSecret:       webhookSecret,
		logger:              logger,
	}
}

// CreateCheckout creates a checkout URL for subscription
func (h *SubscriptionHandlers) CreateCheckout(c *gin.Context) {
	var req services.CreateCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error("Invalid checkout request", zap.Error(err))
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:     APIError{Code: "invalid_request", Message: "Invalid request body"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	req.UserID = userID.(string)

	if req.Email == "" || req.Name == "" || req.VariantID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:     APIError{Code: "invalid_request", Message: "Email, name, and variant ID are required"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	resp, err := h.subscriptionService.CreateCheckout(c.Request.Context(), &req)
	if err != nil {
		h.logger.Error("Failed to create checkout", zap.String("user_id", req.UserID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:     APIError{Code: "checkout_failed", Message: "Failed to create checkout"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetAvailablePlans retrieves all available subscription tiers
func (h *SubscriptionHandlers) GetAvailablePlans(c *gin.Context) {
	tiers := services.GetSubscriptionTiers()
	plans := make([]PlanInfo, len(tiers))
	for i, tier := range tiers {
		plans[i] = PlanInfo{
			ID: tier.ID, Name: tier.Name, VariantID: tier.VariantID,
			Price: tier.Price, Currency: tier.Currency, Features: tier.Features,
		}
	}
	c.JSON(http.StatusOK, PlansResponse{Plans: plans})
}
