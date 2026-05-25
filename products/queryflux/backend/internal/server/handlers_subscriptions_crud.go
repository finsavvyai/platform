package server

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// GetSubscription retrieves the current subscription for the authenticated user
func (h *SubscriptionHandlers) GetSubscription(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	subscription, err := h.subscriptionService.GetUserSubscription(c.Request.Context(), userID.(string))
	if err != nil {
		if err.Error() == "subscription not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:     APIError{Code: "not_found", Message: "No active subscription found"},
				Timestamp: getCurrentTimestamp(),
			})
			return
		}
		h.logger.Error("Failed to get subscription", zap.String("user_id", userID.(string)), zap.Error(err))
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:     APIError{Code: "internal_error", Message: "Failed to retrieve subscription"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	c.JSON(http.StatusOK, subscription)
}

// CancelSubscription cancels the user's active subscription
func (h *SubscriptionHandlers) CancelSubscription(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	var req CancelSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:     APIError{Code: "invalid_request", Message: "Invalid request body"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	if req.Reason == "" {
		req.Reason = "No reason provided"
	}

	err := h.subscriptionService.CancelSubscription(c.Request.Context(), userID.(string), req.Reason)
	if err != nil {
		h.logger.Error("Failed to cancel subscription", zap.String("user_id", userID.(string)), zap.Error(err))
		if err.Error() == "subscription is not active" {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:     APIError{Code: "not_active", Message: "Subscription is not active"},
				Timestamp: getCurrentTimestamp(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:     APIError{Code: "cancellation_failed", Message: "Failed to cancel subscription"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	c.JSON(http.StatusOK, SuccessResponse{Message: "Subscription cancelled successfully"})
}

// PauseSubscription pauses the user's active subscription
func (h *SubscriptionHandlers) PauseSubscription(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	var req PauseSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:     APIError{Code: "invalid_request", Message: "Invalid request body"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	resumeAt := time.Now().Add(time.Duration(req.PauseDays) * 24 * time.Hour)
	if req.ResumeAt != nil {
		resumeAt = *req.ResumeAt
	}

	err := h.subscriptionService.PauseSubscription(c.Request.Context(), userID.(string), resumeAt)
	if err != nil {
		h.logger.Error("Failed to pause subscription", zap.String("user_id", userID.(string)), zap.Error(err))
		if err.Error() == "subscription is not active" {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:     APIError{Code: "not_active", Message: "Subscription is not active"},
				Timestamp: getCurrentTimestamp(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:     APIError{Code: "pause_failed", Message: "Failed to pause subscription"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	c.JSON(http.StatusOK, SuccessResponse{Message: "Subscription paused successfully"})
}

// ResumeSubscription resumes a paused subscription
func (h *SubscriptionHandlers) ResumeSubscription(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:     APIError{Code: "unauthorized", Message: "User not authenticated"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}

	err := h.subscriptionService.ResumeSubscription(c.Request.Context(), userID.(string))
	if err != nil {
		h.logger.Error("Failed to resume subscription", zap.String("user_id", userID.(string)), zap.Error(err))
		if err.Error() == "subscription is not paused" {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:     APIError{Code: "not_paused", Message: "Subscription is not paused"},
				Timestamp: getCurrentTimestamp(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:     APIError{Code: "resume_failed", Message: "Failed to resume subscription"},
			Timestamp: getCurrentTimestamp(),
		})
		return
	}
	c.JSON(http.StatusOK, SuccessResponse{Message: "Subscription resumed successfully"})
}
