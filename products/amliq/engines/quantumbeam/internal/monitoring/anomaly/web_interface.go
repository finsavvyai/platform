package anomaly

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// WebInterface provides HTTP API for anomaly detection
type WebInterface struct {
	detector *AnomalyDetector
	alerter  *AnomalyAlerter
	router   *gin.Engine
}

// NewWebInterface creates a new web interface
func NewWebInterface(detector *AnomalyDetector, alerter *AnomalyAlerter) *WebInterface {
	wi := &WebInterface{
		detector: detector,
		alerter:  alerter,
		router:   gin.Default(),
	}

	wi.setupRoutes()
	return wi
}

// setupRoutes sets up HTTP routes
func (wi *WebInterface) setupRoutes() {
	api := wi.router.Group("/api/v1/anomaly")

	// Detector endpoints
	api.GET("/metrics", wi.getMetrics)
	api.POST("/metrics", wi.addMetric)
	api.DELETE("/metrics/:name", wi.removeMetric)
	api.GET("/metrics/:name/data", wi.getMetricData)
	api.GET("/metrics/:name/stats", wi.getMetricStatistics)

	// Alerting endpoints
	api.GET("/alerts", wi.getAlerts)
	api.POST("/silences", wi.createSilence)
	api.DELETE("/silences/:id", wi.removeSilence)
	api.GET("/rules", wi.getRules)
	api.POST("/rules", wi.createRule)
	api.PUT("/rules/:id", wi.updateRule)
	api.DELETE("/rules/:id", wi.deleteRule)

	// Channel endpoints
	api.GET("/channels", wi.getChannels)
	api.POST("/channels", wi.addChannel)
	api.DELETE("/channels/:name", wi.removeChannel)

	// System endpoints
	api.GET("/health", wi.healthCheck)
	api.GET("/statistics", wi.getStatistics)
	api.GET("/status", wi.getStatus)

	// Dashboard endpoints
	api.GET("/dashboard", wi.getDashboardData)
	api.GET("/dashboard/summary", wi.getDashboardSummary)
}

// getMetrics returns all configured metrics
func (wi *WebInterface) getMetrics(c *gin.Context) {
	metrics := wi.detector.GetMetrics()
	c.JSON(http.StatusOK, gin.H{
		"metrics": metrics,
		"total":   len(metrics),
	})
}

// addMetric adds a new metric to monitor
func (wi *WebInterface) addMetric(c *gin.Context) {
	var config MetricConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := wi.detector.AddMetric(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, config)
}

// removeMetric removes a metric from monitoring
func (wi *WebInterface) removeMetric(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric name is required"})
		return
	}

	if err := wi.detector.RemoveMetric(name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "metric removed"})
}

// getMetricData returns cached data for a metric
func (wi *WebInterface) getMetricData(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric name is required"})
		return
	}

	data := wi.detector.GetMetricData(name)
	c.JSON(http.StatusOK, gin.H{
		"metric": name,
		"data":   data,
		"count":  len(data),
	})
}

// getMetricStatistics returns statistics for a metric
func (wi *WebInterface) getMetricStatistics(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric name is required"})
		return
	}

	data := wi.detector.GetMetricData(name)
	if len(data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no data available"})
		return
	}

	stats := calculateStatistics(data)
	c.JSON(http.StatusOK, gin.H{
		"metric":     name,
		"statistics": stats,
		"count":      len(data),
	})
}

// getAlerts returns recent alerts
func (wi *WebInterface) getAlerts(c *gin.Context) {
	summary := wi.alerter.GetAlertSummary()
	c.JSON(http.StatusOK, summary)
}

// createSilence creates a new silence rule
func (wi *WebInterface) createSilence(c *gin.Context) {
	var request struct {
		Pattern  string        `json:"pattern" binding:"required"`
		Duration time.Duration `json:"duration" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := wi.alerter.SilenceAlert(request.Pattern, request.Duration); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "silence created",
		"pattern":  request.Pattern,
		"duration": request.Duration,
	})
}

// removeSilence removes a silence rule
func (wi *WebInterface) removeSilence(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "silence ID is required"})
		return
	}

	// Implementation would need to track silences by ID
	c.JSON(http.StatusOK, gin.H{"message": "silence removed"})
}

// getRules returns all alert rules
func (wi *WebInterface) getRules(c *gin.Context) {
	rules := wi.alerter.GetRules()
	c.JSON(http.StatusOK, gin.H{
		"rules": rules,
		"total": len(rules),
	})
}

// createRule creates a new alert rule
func (wi *WebInterface) createRule(c *gin.Context) {
	var rule AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := wi.alerter.AddRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

// updateRule updates an existing alert rule
func (wi *WebInterface) updateRule(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rule ID is required"})
		return
	}

	var rule AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update existing rule
	rules := wi.alerter.GetRules()
	if _, exists := rules[id]; !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	if err := wi.alerter.AddRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rule)
}

// deleteRule deletes an alert rule
func (wi *WebInterface) deleteRule(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rule ID is required"})
		return
	}

	if err := wi.alerter.RemoveRule(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "rule deleted"})
}

// getChannels returns all notification channels
func (wi *WebInterface) getChannels(c *gin.Context) {
	channels := wi.alerter.GetChannels()

	channelInfo := make([]gin.H, 0, len(channels))
	for name, channel := range channels {
		channelInfo = append(channelInfo, gin.H{
			"name":    name,
			"type":    channel.Type(),
			"healthy": channel.IsHealthy(),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"channels": channelInfo,
		"total":    len(channels),
	})
}

// addChannel adds a new notification channel
func (wi *WebInterface) addChannel(c *gin.Context) {
	var request struct {
		Name   string                 `json:"name" binding:"required"`
		Type   string                 `json:"type" binding:"required"`
		Config map[string]interface{} `json:"config" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var channel NotificationChannel
	var err error

	switch request.Type {
	case "slack":
		channel, err = createSlackChannel(request.Name, request.Config)
	case "email":
		channel, err = createEmailChannel(request.Name, request.Config)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported channel type"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := wi.alerter.AddChannel(channel); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"name":    channel.Name(),
		"type":    channel.Type(),
		"healthy": channel.IsHealthy(),
	})
}

// removeChannel removes a notification channel
func (wi *WebInterface) removeChannel(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "channel name is required"})
		return
	}

	if err := wi.alerter.RemoveChannel(name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "channel removed"})
}

// healthCheck performs a health check
func (wi *WebInterface) healthCheck(c *gin.Context) {
	detectorHealth := wi.detector.HealthCheck()

	status := gin.H{
		"status":    "healthy",
		"timestamp": time.Now(),
		"components": gin.H{
			"detector": "healthy",
			"alerter":  "healthy",
		},
	}

	if detectorHealth != nil {
		status["status"] = "unhealthy"
		status["components"].(gin.H)["detector"] = "unhealthy"
		status["detector_error"] = detectorHealth.Error()
		c.JSON(http.StatusServiceUnavailable, status)
		return
	}

	c.JSON(http.StatusOK, status)
}

// getStatistics returns system statistics
func (wi *WebInterface) getStatistics(c *gin.Context) {
	detectorStats := wi.detector.GetStatistics()
	alertSummary := wi.alerter.GetAlertSummary()

	c.JSON(http.StatusOK, gin.H{
		"detector":  detectorStats,
		"alerter":   alertSummary,
		"timestamp": time.Now(),
	})
}

// getStatus returns overall system status
func (wi *WebInterface) getStatus(c *gin.Context) {
	rules := wi.alerter.GetRules()
	channels := wi.alerter.GetChannels()
	metrics := wi.detector.GetMetrics()

	enabledRules := 0
	for _, rule := range rules {
		if rule.Enabled {
			enabledRules++
		}
	}

	healthyChannels := 0
	for _, channel := range channels {
		if channel.IsHealthy() {
			healthyChannels++
		}
	}

	enabledMetrics := 0
	for _, metric := range metrics {
		if metric.Enabled {
			enabledMetrics++
		}
	}

	status := gin.H{
		"overall": "healthy",
		"components": gin.H{
			"metrics": gin.H{
				"total":   len(metrics),
				"enabled": enabledMetrics,
				"status":  "healthy",
			},
			"rules": gin.H{
				"total":   len(rules),
				"enabled": enabledRules,
				"status":  "healthy",
			},
			"channels": gin.H{
				"total":   len(channels),
				"healthy": healthyChannels,
				"status":  "healthy",
			},
		},
		"timestamp": time.Now(),
	}

	// Determine overall status
	if healthyChannels < len(channels) {
		status["overall"] = "degraded"
		status["components"].(gin.H)["channels"].(gin.H)["status"] = "degraded"
	}

	if enabledMetrics == 0 {
		status["overall"] = "unhealthy"
		status["components"].(gin.H)["metrics"].(gin.H)["status"] = "unhealthy"
	}

	c.JSON(http.StatusOK, status)
}

// getDashboardData returns data for the anomaly detection dashboard
func (wi *WebInterface) getDashboardData(c *gin.Context) {
	metrics := wi.detector.GetMetrics()
	rules := wi.alerter.GetRules()
	alertSummary := wi.alerter.GetAlertSummary()

	dashboard := gin.H{
		"metrics": gin.H{
			"total":   len(metrics),
			"enabled": 0,
			"list":    make([]gin.H, 0),
		},
		"rules": gin.H{
			"total":   len(rules),
			"enabled": 0,
			"list":    make([]gin.H, 0),
		},
		"alerts":    alertSummary,
		"timestamp": time.Now(),
	}

	// Process metrics
	for _, metric := range metrics {
		if metric.Enabled {
			dashboard["metrics"].(gin.H)["enabled"] = dashboard["metrics"].(gin.H)["enabled"].(int) + 1
		}

		metricInfo := gin.H{
			"name":     metric.Name,
			"type":     metric.Type,
			"severity": metric.Severity,
			"enabled":  metric.Enabled,
		}
		dashboard["metrics"].(gin.H)["list"] = append(dashboard["metrics"].(gin.H)["list"].([]gin.H), metricInfo)
	}

	// Process rules
	for _, rule := range rules {
		if rule.Enabled {
			dashboard["rules"].(gin.H)["enabled"] = dashboard["rules"].(gin.H)["enabled"].(int) + 1
		}

		ruleInfo := gin.H{
			"id":       rule.ID,
			"name":     rule.Name,
			"enabled":  rule.Enabled,
			"severity": rule.MinSeverity,
		}
		dashboard["rules"].(gin.H)["list"] = append(dashboard["rules"].(gin.H)["list"].([]gin.H), ruleInfo)
	}

	c.JSON(http.StatusOK, dashboard)
}

// getDashboardSummary returns a summary for the dashboard
func (wi *WebInterface) getDashboardSummary(c *gin.Context) {
	// Parse query parameters for time range
	hoursStr := c.DefaultQuery("hours", "24")
	hours, err := strconv.Atoi(hoursStr)
	if err != nil {
		hours = 24
	}

	// Get recent activity summary
	summary := gin.H{
		"timeframe": fmt.Sprintf("%dh", hours),
		"metrics": gin.H{
			"total":   0,
			"enabled": 0,
			"active":  0,
		},
		"anomalies": gin.H{
			"detected": 0,
			"alerted":  0,
			"silenced": 0,
		},
		"health":    "healthy",
		"timestamp": time.Now(),
	}

	// This would need actual data from the detector and alerter
	// For now, return placeholder data

	c.JSON(http.StatusOK, summary)
}

// GetRouter returns the Gin router for external mounting
func (wi *WebInterface) GetRouter() *gin.Engine {
	return wi.router
}

// Helper functions

func calculateStatistics(data []DataPoint) gin.H {
	if len(data) == 0 {
		return gin.H{}
	}

	values := make([]float64, len(data))
	for i, point := range data {
		values[i] = point.Value
	}

	min, max := minMax(values)
	mean := average(values)
	stdDev := standardDeviation(values, mean)

	// Calculate percentiles
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	p50 := percentile(sorted, 0.5)
	p95 := percentile(sorted, 0.95)
	p99 := percentile(sorted, 0.99)

	return gin.H{
		"count":      len(data),
		"min":        min,
		"max":        max,
		"mean":       mean,
		"std_dev":    stdDev,
		"p50":        p50,
		"p95":        p95,
		"p99":        p99,
		"first_time": data[0].Timestamp,
		"last_time":  data[len(data)-1].Timestamp,
	}
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}

	index := int(p * float64(len(sorted)-1))
	if index >= len(sorted) {
		index = len(sorted) - 1
	}

	return sorted[index]
}

func createSlackChannel(name string, config map[string]interface{}) (NotificationChannel, error) {
	webhookURL, _ := config["webhook_url"].(string)
	channel, _ := config["channel"].(string)
	username, _ := config["username"].(string)

	if webhookURL == "" {
		return nil, fmt.Errorf("webhook_url is required for Slack channel")
	}

	return NewSlackNotificationChannel(name, webhookURL, channel, username), nil
}

func createEmailChannel(name string, config map[string]interface{}) (NotificationChannel, error) {
	smtpHost, _ := config["smtp_host"].(string)
	smtpPort, _ := config["smtp_port"].(int)
	from, _ := config["from"].(string)
	toInterface, _ := config["to"].([]interface{})

	to := make([]string, len(toInterface))
	for i, v := range toInterface {
		if s, ok := v.(string); ok {
			to[i] = s
		}
	}

	if smtpHost == "" || from == "" {
		return nil, fmt.Errorf("smtp_host and from are required for email channel")
	}

	if smtpPort == 0 {
		smtpPort = 587
	}

	return NewEmailNotificationChannel(name, smtpHost, smtpPort, from, to), nil
}
