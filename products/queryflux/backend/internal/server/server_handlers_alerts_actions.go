package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (s *Server) resolveAlert(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	alertID := c.Param("id")
	if alertID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "VALIDATION_ERROR", "message": "Alert ID is required",
		})
		return
	}

	alertService := s.container.GetAlertService()
	alert, err := alertService.GetByID(c.Request.Context(), alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "ALERT_NOT_FOUND", "message": "Alert not found",
		})
		return
	}
	if alert.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "ACCESS_DENIED", "message": "Access denied to this alert",
		})
		return
	}

	if err := alertService.Resolve(c.Request.Context(), alertID); err != nil {
		if strings.Contains(err.Error(), "already resolved") {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "ALERT_ALREADY_RESOLVED", "message": "Alert is already resolved",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "ALERT_RESOLVE_FAILED", "message": "Failed to resolve alert",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert resolved successfully", "alert_id": alertID})
}

func (s *Server) muteAlert(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	alertID := c.Param("id")
	if alertID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "VALIDATION_ERROR", "message": "Alert ID is required",
		})
		return
	}

	alertService := s.container.GetAlertService()
	alert, err := alertService.GetByID(c.Request.Context(), alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "ALERT_NOT_FOUND", "message": "Alert not found",
		})
		return
	}
	if alert.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "ACCESS_DENIED", "message": "Access denied to this alert",
		})
		return
	}

	if err := alertService.Mute(c.Request.Context(), alertID); err != nil {
		if strings.Contains(err.Error(), "already muted") {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "ALERT_ALREADY_MUTED", "message": "Alert is already muted",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "ALERT_MUTE_FAILED", "message": "Failed to mute alert",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert muted successfully", "alert_id": alertID})
}
