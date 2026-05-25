package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// GetUsageStats retrieves usage statistics for the current billing period
func (h *SubscriptionHandlers) GetUsageStats(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	stats, err := h.subscriptionService.GetUserUsageStats(c.Request.Context(), userID.(string))
	if err != nil {
		h.logger.Error("Failed to get usage stats", zap.String("user_id", userID.(string)), zap.Error(err))
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:     APIError{Code: "internal_error", Message: "Failed to retrieve usage statistics"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// CheckFeatureAccess checks if the user has access to a specific feature
func (h *SubscriptionHandlers) CheckFeatureAccess(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	feature := c.Query("feature")
	if feature == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:     APIError{Code: "invalid_request", Message: "Feature parameter is required"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	hasAccess, err := h.subscriptionService.CheckFeatureAccess(c.Request.Context(), userID.(string), feature)
	if err != nil {
		h.logger.Error("Failed to check feature access",
			zap.String("user_id", userID.(string)), zap.String("feature", feature), zap.Error(err))
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:     APIError{Code: "internal_error", Message: "Failed to check feature access"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	c.JSON(http.StatusOK, FeatureAccessResponse{Feature: feature, HasAccess: hasAccess})
}

// GetInvoices retrieves a list of invoices for the authenticated user
func (h *SubscriptionHandlers) GetInvoices(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	invoices, err := h.subscriptionService.GetUserInvoices(c.Request.Context(), userID.(string))
	if err != nil {
		h.logger.Error("Failed to get invoices", zap.String("user_id", userID.(string)), zap.Error(err))
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:     APIError{Code: "internal_error", Message: "Failed to retrieve invoices"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	c.JSON(http.StatusOK, invoices)
}

// GetInvoice retrieves details for a specific invoice
func (h *SubscriptionHandlers) GetInvoice(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	invoiceID := c.Param("id")
	if invoiceID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:     APIError{Code: "invalid_request", Message: "Invoice ID is required"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	invoice, err := h.subscriptionService.GetUserInvoice(c.Request.Context(), userID.(string), invoiceID)
	if err != nil {
		h.logger.Error("Failed to get invoice",
			zap.String("user_id", userID.(string)), zap.String("invoice_id", invoiceID), zap.Error(err))
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:     APIError{Code: "not_found", Message: "Invoice not found"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	c.JSON(http.StatusOK, invoice)
}

// HandleWebhook processes webhook events from Lemon Squeezy
func (h *SubscriptionHandlers) HandleWebhook(c *gin.Context) {
	if h.lemonSqueezyService == nil {
		h.logger.Error("Lemon Squeezy service not configured")
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:     APIError{Code: "service_unavailable", Message: "Payment service not configured"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	secret := h.webhookSecret
	if secret == "" {
		secret = "default_webhook_secret"
	}

	webhookHandler := h.lemonSqueezyService.CreateWebhookHandler(secret)
	webhookHandler(c.Writer, c.Request)
}
