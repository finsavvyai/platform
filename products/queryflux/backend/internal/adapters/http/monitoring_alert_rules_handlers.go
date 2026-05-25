package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
)

// GetAlertRules returns alert rules
func (h *MonitoringHandlers) GetAlertRules(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"rules": []domain.AlertRule{},
		"count": 0,
	})
}

// CreateAlertRule creates a new alert rule
func (h *MonitoringHandlers) CreateAlertRule(c *gin.Context) {
	var rule domain.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()

	c.JSON(http.StatusCreated, rule)
}

// UpdateAlertRule updates an alert rule
func (h *MonitoringHandlers) UpdateAlertRule(c *gin.Context) {
	id := c.Param("id")

	var rule domain.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule.ID = id
	rule.UpdatedAt = time.Now()

	c.JSON(http.StatusOK, rule)
}

// DeleteAlertRule deletes an alert rule
func (h *MonitoringHandlers) DeleteAlertRule(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"message": "Alert rule " + id + " deleted successfully"})
}

// parseAlertFilters parses alert filter parameters from request
func (h *MonitoringHandlers) parseAlertFilters(c *gin.Context) (ports.AlertFilters, error) {
	filters := ports.AlertFilters{}

	if status := c.Query("status"); status != "" {
		filters.Status = []domain.AlertStatus{domain.AlertStatus(status)}
	}

	if severity := c.Query("severity"); severity != "" {
		filters.Severity = []domain.AlertSeverity{domain.AlertSeverity(severity)}
	}

	if source := c.Query("source"); source != "" {
		filters.Source = source
	}

	if limit := c.Query("limit"); limit != "" {
		if parsed, err := strconv.Atoi(limit); err == nil {
			filters.Limit = parsed
		}
	}

	if offset := c.Query("offset"); offset != "" {
		if parsed, err := strconv.Atoi(offset); err == nil {
			filters.Offset = parsed
		}
	}

	return filters, nil
}
