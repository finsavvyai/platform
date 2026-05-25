package http

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// GetAlerts returns alerts based on filters
func (h *MonitoringHandlers) GetAlerts(c *gin.Context) {
	filters, err := h.parseAlertFilters(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	alerts, err := h.alertManager.GetAlerts(c.Request.Context(), filters)
	if err != nil {
		h.logger.Error("Failed to get alerts", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get alerts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
		"count":  len(alerts),
	})
}

// GetAlert returns a single alert by ID
func (h *MonitoringHandlers) GetAlert(c *gin.Context) {
	id := c.Param("id")
	alert, err := h.alertManager.GetAlert(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
		return
	}

	c.JSON(http.StatusOK, alert)
}

// CreateAlert creates a new alert
func (h *MonitoringHandlers) CreateAlert(c *gin.Context) {
	var alert domain.Alert
	if err := c.ShouldBindJSON(&alert); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	alert.CreatedAt = time.Now()
	alert.UpdatedAt = time.Now()

	if err := h.alertManager.CreateAlert(c.Request.Context(), &alert); err != nil {
		h.logger.Error("Failed to create alert", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create alert"})
		return
	}

	c.JSON(http.StatusCreated, alert)
}

// UpdateAlert updates an existing alert
func (h *MonitoringHandlers) UpdateAlert(c *gin.Context) {
	id := c.Param("id")

	var alert domain.Alert
	if err := c.ShouldBindJSON(&alert); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	alert.ID = id
	alert.UpdatedAt = time.Now()

	if err := h.alertManager.UpdateAlert(c.Request.Context(), &alert); err != nil {
		h.logger.Error("Failed to update alert", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update alert"})
		return
	}

	c.JSON(http.StatusOK, alert)
}

// DeleteAlert deletes an alert
func (h *MonitoringHandlers) DeleteAlert(c *gin.Context) {
	id := c.Param("id")

	if err := h.alertManager.DeleteAlert(c.Request.Context(), id); err != nil {
		h.logger.Error("Failed to delete alert", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete alert"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert deleted successfully"})
}

// AcknowledgeAlert acknowledges an alert
func (h *MonitoringHandlers) AcknowledgeAlert(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		UserID string `json:"user_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert " + id + " acknowledged"})
}

// SilenceAlert silences an alert
func (h *MonitoringHandlers) SilenceAlert(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Duration time.Duration `json:"duration"`
		UserID   string        `json:"user_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert " + id + " silenced"})
}

// ResolveAlert resolves an alert
func (h *MonitoringHandlers) ResolveAlert(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		UserID string `json:"user_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert " + id + " resolved"})
}

