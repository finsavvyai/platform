package server

import (
	"net/http"
	"time"

	"github.com/queryflux/backend/internal/application/ports"

	"github.com/gin-gonic/gin"
)

func (s *Server) getMetricsHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	connectionID := c.Param("id")
	if connectionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Connection ID is required",
		})
		return
	}

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(c.Request.Context(), connectionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "CONNECTION_NOT_FOUND",
			"message": "Connection not found",
		})
		return
	}

	if connection.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "ACCESS_DENIED",
			"message": "Access denied to this connection",
		})
		return
	}

	timeRange := c.DefaultQuery("time_range", "24h")
	interval := c.DefaultQuery("interval", "auto")
	metricNames := c.QueryArray("metric")

	monitoringService := s.container.GetMonitoringService()
	if monitoringService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "MONITORING_UNAVAILABLE",
			"message": "Monitoring service is not available",
		})
		return
	}

	query := &ports.MetricsQuery{
		Source:       "database",
		ConnectionID: connectionID,
		Labels: map[string]string{
			"connection_id": connectionID,
			"database_type": connection.Type,
		},
		StartTime: s.calculateStartTime(timeRange),
		EndTime:   time.Now(),
		Limit:     10000,
	}

	if len(metricNames) > 0 {
		query.MetricNames = metricNames
	} else {
		query.MetricNames = defaultDatabaseMetrics()
	}

	series, err := monitoringService.GetMetricSeries(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "METRICS_HISTORY_FAILED",
			"message": "Failed to retrieve metrics history",
			"details": err.Error(),
		})
		return
	}

	if interval == "auto" {
		interval = s.calculateAggregationInterval(timeRange).String()
	}

	processedSeries := s.processMetricSeries(series, interval)

	c.JSON(http.StatusOK, gin.H{
		"connection_id": connectionID,
		"time_range":    timeRange,
		"interval":      interval,
		"start_time":    query.StartTime,
		"end_time":      query.EndTime,
		"series":        processedSeries,
		"total_points":  countTotalDataPoints(processedSeries),
	})
}
