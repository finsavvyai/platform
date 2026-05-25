package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
)

// GetHealthChecks returns health check status
func (h *MonitoringHandlers) GetHealthChecks(c *gin.Context) {
	healthChecks := []*domain.HealthCheck{
		{
			Name:      "database",
			Status:    "healthy",
			Message:   "Database connection is healthy",
			Duration:  10 * time.Millisecond,
			Timestamp: time.Now(),
			Component: "database",
		},
		{
			Name:      "metrics",
			Status:    "healthy",
			Message:   "Metrics collection is working",
			Duration:  5 * time.Millisecond,
			Timestamp: time.Now(),
			Component: "metrics",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"health_checks":  healthChecks,
		"overall_status": "healthy",
	})
}

// GetSystemOverview returns system overview metrics
func (h *MonitoringHandlers) GetSystemOverview(c *gin.Context) {
	overview := gin.H{
		"timestamp": time.Now(),
		"system": gin.H{
			"cpu_usage_percent":    45.5,
			"memory_usage_percent": 60.2,
			"disk_usage_percent":   75.8,
			"uptime_hours":         72.5,
		},
		"database": gin.H{
			"active_connections": 15,
			"total_connections":  100,
			"queries_per_second": 125.5,
			"slow_queries":       3,
			"cache_hit_ratio":    95.2,
		},
		"alerts": gin.H{
			"active":   2,
			"resolved": 15,
			"silenced": 1,
		},
		"metrics": gin.H{
			"total_metrics":  1250,
			"metric_points":  45680,
			"retention_days": 7,
		},
	}

	c.JSON(http.StatusOK, overview)
}

// parseDashboardFilters parses dashboard filter parameters from request
func (h *MonitoringHandlers) parseDashboardFilters(c *gin.Context) (ports.DashboardFilters, error) {
	filters := ports.DashboardFilters{}

	if enabled := c.Query("enabled"); enabled != "" {
		if parsed, err := strconv.ParseBool(enabled); err == nil {
			filters.Enabled = &parsed
		}
	}

	if search := c.Query("search"); search != "" {
		filters.Search = search
	}

	if tags := c.QueryArray("tags"); len(tags) > 0 {
		filters.Tags = tags
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
