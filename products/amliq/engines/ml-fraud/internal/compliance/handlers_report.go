package compliance

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// overrideRequest is the JSON body for the override endpoint.
type overrideRequest struct {
	Status string `json:"status" binding:"required"`
	Reason string `json:"reason" binding:"required"`
}

// CollectEvidence triggers evidence collection and returns 202 Accepted.
func (h *ComplianceHandler) CollectEvidence(c *gin.Context) {
	tenantID := getTenantID(c)

	_, err := h.generator.GenerateDashboardStats(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "evidence collection failed"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"status":  "accepted",
		"message": "evidence collection started for tenant " + tenantID,
	})
}

// GenerateReport produces a compliance report for the specified framework.
func (h *ComplianceHandler) GenerateReport(c *gin.Context) {
	fw := c.Query("framework")
	if fw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "framework query parameter is required"})
		return
	}

	framework := ComplianceFramework(fw)
	if !isValidFramework(framework) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid framework: " + fw})
		return
	}

	tenantID := getTenantID(c)
	report, err := h.generator.GenerateReport(c.Request.Context(), tenantID, framework)
	if err != nil {
		if errors.Is(err, ErrFrameworkNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "framework not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate report"})
		return
	}

	c.JSON(http.StatusOK, report)
}

// GetDashboard returns aggregate compliance dashboard statistics.
func (h *ComplianceHandler) GetDashboard(c *gin.Context) {
	tenantID := getTenantID(c)

	stats, err := h.generator.GenerateDashboardStats(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate dashboard stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// OverrideControlStatus allows manual status override for a control.
func (h *ComplianceHandler) OverrideControlStatus(c *gin.Context) {
	controlID := c.Param("id")

	def, err := h.registry.GetControl(controlID)
	if err != nil {
		if errors.Is(err, ErrControlNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "control not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get control"})
		return
	}

	var req overrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status and reason are required"})
		return
	}

	newStatus := ControlStatus(req.Status)
	if !isValidStatus(newStatus) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status: " + req.Status})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"control_id": controlID,
		"framework":  def.Control.Framework,
		"old_status": def.Control.Status,
		"new_status": newStatus,
		"reason":     req.Reason,
		"message":    "control status overridden",
	})
}
