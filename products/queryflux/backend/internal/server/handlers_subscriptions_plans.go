package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ChangePlan changes the subscription to a different plan
func (h *SubscriptionHandlers) ChangePlan(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	var req ChangePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:     APIError{Code: "invalid_request", Message: "Invalid request body"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	if req.VariantID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:     APIError{Code: "invalid_request", Message: "Variant ID is required"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	err := h.subscriptionService.ChangePlan(c.Request.Context(), userID.(string), req.VariantID)
	if err != nil {
		h.logger.Error("Failed to change plan",
			zap.String("user_id", userID.(string)), zap.String("variant_id", req.VariantID), zap.Error(err))
		if err.Error() == "subscription cannot be upgraded" {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:     APIError{Code: "cannot_upgrade", Message: "Subscription cannot be upgraded at this time"},
				Timestamp: getCurrentTimestamp(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:     APIError{Code: "plan_change_failed", Message: "Failed to change plan"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	c.JSON(http.StatusOK, SuccessResponse{Message: "Plan change initiated successfully"})
}
