package http

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// GetDashboards returns dashboards based on filters
func (h *MonitoringHandlers) GetDashboards(c *gin.Context) {
	filters, err := h.parseDashboardFilters(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dashboards, err := h.dashboardManager.GetDashboards(c.Request.Context(), filters)
	if err != nil {
		h.logger.Error("Failed to get dashboards", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get dashboards"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"dashboards": dashboards,
		"count":      len(dashboards),
	})
}

// GetDashboard returns a single dashboard by ID
func (h *MonitoringHandlers) GetDashboard(c *gin.Context) {
	id := c.Param("id")
	dashboard, err := h.dashboardManager.GetDashboard(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dashboard not found"})
		return
	}

	c.JSON(http.StatusOK, dashboard)
}

// CreateDashboard creates a new dashboard
func (h *MonitoringHandlers) CreateDashboard(c *gin.Context) {
	var dashboard domain.MonitoringDashboard
	if err := c.ShouldBindJSON(&dashboard); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dashboard.CreatedAt = time.Now()
	dashboard.UpdatedAt = time.Now()

	if err := h.dashboardManager.CreateDashboard(c.Request.Context(), &dashboard); err != nil {
		h.logger.Error("Failed to create dashboard", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create dashboard"})
		return
	}

	c.JSON(http.StatusCreated, dashboard)
}

// UpdateDashboard updates an existing dashboard
func (h *MonitoringHandlers) UpdateDashboard(c *gin.Context) {
	id := c.Param("id")

	var dashboard domain.MonitoringDashboard
	if err := c.ShouldBindJSON(&dashboard); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dashboard.ID = id
	dashboard.UpdatedAt = time.Now()

	if err := h.dashboardManager.UpdateDashboard(c.Request.Context(), &dashboard); err != nil {
		h.logger.Error("Failed to update dashboard", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update dashboard"})
		return
	}

	c.JSON(http.StatusOK, dashboard)
}

// DeleteDashboard deletes a dashboard
func (h *MonitoringHandlers) DeleteDashboard(c *gin.Context) {
	id := c.Param("id")

	if err := h.dashboardManager.DeleteDashboard(c.Request.Context(), id); err != nil {
		h.logger.Error("Failed to delete dashboard", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete dashboard"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Dashboard deleted successfully"})
}

// DuplicateDashboard duplicates a dashboard
func (h *MonitoringHandlers) DuplicateDashboard(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		NewName string `json:"new_name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dashboard, err := h.dashboardManager.DuplicateDashboard(c.Request.Context(), id, req.NewName)
	if err != nil {
		h.logger.Error("Failed to duplicate dashboard", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to duplicate dashboard"})
		return
	}

	c.JSON(http.StatusOK, dashboard)
}

