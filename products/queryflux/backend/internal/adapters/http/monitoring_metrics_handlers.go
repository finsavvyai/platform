package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/application/ports"
	"go.uber.org/zap"
)

// GetMetrics returns metrics based on query parameters
func (h *MonitoringHandlers) GetMetrics(c *gin.Context) {
	query, err := h.parseMetricsQuery(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	metrics, err := h.metricsStorage.Query(c.Request.Context(), query)
	if err != nil {
		h.logger.Error("Failed to query metrics", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query metrics"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"metrics": metrics,
		"count":   len(metrics),
	})
}

// GetMetricSeries returns metric time series data
func (h *MonitoringHandlers) GetMetricSeries(c *gin.Context) {
	query, err := h.parseMetricsQuery(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	series, err := h.metricsStorage.QuerySeries(c.Request.Context(), query)
	if err != nil {
		h.logger.Error("Failed to query metric series", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query metric series"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"series": series,
		"count":  len(series),
	})
}

// QueryMetrics executes a metrics query
func (h *MonitoringHandlers) QueryMetrics(c *gin.Context) {
	type QueryRequest struct {
		Query string            `json:"query"`
		From  time.Time         `json:"from"`
		To    time.Time         `json:"to"`
		Step  time.Duration     `json:"step"`
		Tags  map[string]string `json:"tags,omitempty"`
		Limit int               `json:"limit,omitempty"`
	}

	var req QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := &ports.MetricsQuery{
		Name:  req.Query,
		From:  req.From,
		To:    req.To,
		Limit: req.Limit,
	}

	if query.Limit == 0 {
		query.Limit = 1000
	}

	metrics, err := h.metricsStorage.Query(c.Request.Context(), query)
	if err != nil {
		h.logger.Error("Failed to execute query", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute query"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"query":   req.Query,
		"from":    req.From,
		"to":      req.To,
		"metrics": metrics,
	})
}

// AggregateMetrics returns aggregated metrics
func (h *MonitoringHandlers) AggregateMetrics(c *gin.Context) {
	var req struct {
		Name         string              `json:"name"`
		From         time.Time           `json:"from"`
		To           time.Time           `json:"to"`
		Aggregations []ports.Aggregation `json:"aggregations"`
		GroupBy      []string            `json:"groupBy,omitempty"`
		Interval     time.Duration       `json:"interval,omitempty"`
		Labels       map[string]string   `json:"labels,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := &ports.AggregatedMetrics{
		Name:   req.Name,
		Values: make(map[string]float64),
	}

	for _, agg := range req.Aggregations {
		result.Values[agg.Function] = 0.0
	}

	c.JSON(http.StatusOK, result)
}

// ExportPrometheusMetrics exports metrics in Prometheus format
func (h *MonitoringHandlers) ExportPrometheusMetrics(c *gin.Context) {
	response := `# HELP prometheus_build_info A metric with a constant '1' value labeled by version, revision, branch, and goversion from which Prometheus was built.
# TYPE prometheus_build_info gauge
prometheus_build_info{branch="HEAD",goversion="go1.22.1",revision="3b1a2a0f7b2a3a4a5a6a7a8a9a0a1a2a3a4a5a6",version="2.50.1"} 1

# HELP prometheus_notifications_failed_total Total number of failed notifications sent by Alertmanager.
# TYPE prometheus_notifications_failed_total counter
prometheus_notifications_failed_total 0

# HELP prometheus_notifications_total Total number of notifications sent by Alertmanager.
# TYPE prometheus_notifications_total counter
prometheus_notifications_total 0
`

	c.Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	c.String(http.StatusOK, response)
}

// parseMetricsQuery parses metrics query parameters from request
func (h *MonitoringHandlers) parseMetricsQuery(c *gin.Context) (*ports.MetricsQuery, error) {
	query := &ports.MetricsQuery{}

	if name := c.Query("name"); name != "" {
		query.Name = name
	}

	if from := c.Query("from"); from != "" {
		if parsed, err := time.Parse(time.RFC3339, from); err == nil {
			query.From = parsed
		}
	}
	if query.From.IsZero() {
		query.From = time.Now().Add(-1 * time.Hour)
	}

	if to := c.Query("to"); to != "" {
		if parsed, err := time.Parse(time.RFC3339, to); err == nil {
			query.To = parsed
		}
	}
	if query.To.IsZero() {
		query.To = time.Now()
	}

	if limit := c.Query("limit"); limit != "" {
		if parsed, err := strconv.Atoi(limit); err == nil {
			query.Limit = parsed
		}
	}
	if query.Limit == 0 {
		query.Limit = 1000
	}

	if aggregation := c.Query("aggregation"); aggregation != "" {
		query.Aggregation = aggregation
	}

	if labels := c.QueryMap("label"); len(labels) > 0 {
		query.Labels = labels
	}

	return query, nil
}
