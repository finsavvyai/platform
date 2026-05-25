package server

import (
	"net/http"
	"time"

	"github.com/queryflux/backend/internal/application/ports"

	"github.com/gin-gonic/gin"
)

func (s *Server) getConnectionMetrics(c *gin.Context) {
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

	timeRange := c.DefaultQuery("time_range", "1h")
	metricType := c.DefaultQuery("metric_type", "all")
	aggregation := c.DefaultQuery("aggregation", "avg")

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
		Limit:     1000,
	}

	if metricType != "all" {
		query.MetricNames = s.getMetricNamesByType(metricType)
	}

	metrics, err := monitoringService.GetMetrics(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "METRICS_FETCH_FAILED",
			"message": "Failed to retrieve connection metrics",
			"details": err.Error(),
		})
		return
	}

	var aggregatedMetrics *ports.AggregatedMetrics
	if aggregation != "raw" {
		aggregationQuery := &ports.AggregationQuery{
			BaseQuery:   query,
			Aggregation: aggregation,
			Interval:    s.calculateAggregationInterval(timeRange),
		}
		aggregatedMetrics, err = monitoringService.AggregateMetrics(c.Request.Context(), aggregationQuery)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "METRICS_AGGREGATION_FAILED",
				"message": "Failed to aggregate metrics",
				"details": err.Error(),
			})
			return
		}
	}

	response := gin.H{
		"connection_id": connectionID,
		"time_range":    timeRange,
		"metric_type":   metricType,
		"aggregation":   aggregation,
		"start_time":    query.StartTime,
		"end_time":      query.EndTime,
	}

	if aggregatedMetrics != nil {
		response["aggregated_metrics"] = aggregatedMetrics
	} else {
		response["metrics"] = metrics
	}

	c.JSON(http.StatusOK, response)
}
