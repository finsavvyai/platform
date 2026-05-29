//go:build legacy_migrated
// +build legacy_migrated

package fraud

import (
	"context"
	"encoding/json"
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// HealthHandler handles health check requests
type HealthHandler struct {
	service       *ProductionService
	logger        *zap.Logger
	startTime     time.Time
	version       string
	buildTime     string
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(service *ProductionService, logger *zap.Logger, version, buildTime string) *HealthHandler {
	return &HealthHandler{
		service:   service,
		logger:    logger,
		startTime: time.Now(),
		version:   version,
		buildTime: buildTime,
	}
}

// RegisterRoutes registers health check routes
func (h *HealthHandler) RegisterRoutes(router *gin.RouterGroup) {
	health := router.Group("/health")
	{
		health.GET("", h.BasicHealthCheck)
		health.GET("/live", h.LivenessCheck)
		health.GET("/ready", h.ReadinessCheck)
		health.GET("/detailed", h.DetailedHealthCheck)
		health.GET("/metrics", h.MetricsHealthCheck)
	}
}

// BasicHealthCheck provides a simple health check endpoint
func (h *HealthHandler) BasicHealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "quantumbeam-fraud-detection",
		"time":    time.Now().UTC(),
	})
}

// LivenessCheck checks if the service is alive
func (h *HealthHandler) LivenessCheck(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Basic liveness check - can the service respond?
	status := map[string]interface{}{
		"alive":   true,
		"uptime":  time.Since(h.startTime).Seconds(),
		"version": h.version,
		"time":    time.Now().UTC(),
	}

	// Check if context is still valid
	select {
	case <-ctx.Done():
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"alive":  false,
			"error":  "context timeout",
			"status": "unhealthy",
		})
		return
	default:
	}

	c.JSON(http.StatusOK, status)
}

// ReadinessCheck checks if the service is ready to accept traffic
func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	ready := true
	checks := make(map[string]interface{})

	// Check quantum backend availability
	quantumStatus, err := h.checkQuantumBackend(ctx)
	checks["quantum_backend"] = quantumStatus
	if err != nil {
		ready = false
		h.logger.Warn("Quantum backend check failed", zap.Error(err))
	}

	// Check circuit breaker state
	if h.service.circuitBreaker != nil {
		cbState := h.service.circuitBreaker.GetState()
		checks["circuit_breaker"] = map[string]interface{}{
			"state":   cbState.String(),
			"healthy": cbState == CircuitStateClosed,
		}
		if cbState == CircuitStateOpen {
			ready = false
		}
	}

	// Check memory usage
	memStatus := h.checkMemoryUsage()
	checks["memory"] = memStatus
	if !memStatus["healthy"].(bool) {
		ready = false
	}

	status := map[string]interface{}{
		"ready":      ready,
		"service":    "quantumbeam-fraud-detection",
		"version":    h.version,
		"build_time": h.buildTime,
		"uptime":     time.Since(h.startTime).Seconds(),
		"checks":     checks,
		"time":       time.Now().UTC(),
	}

	if ready {
		c.JSON(http.StatusOK, status)
	} else {
		c.JSON(http.StatusServiceUnavailable, status)
	}
}

// DetailedHealthCheck provides comprehensive health information
func (h *HealthHandler) DetailedHealthCheck(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	// Get health status from service
	healthStatus, err := h.service.GetHealth(ctx)
	if err != nil {
		h.logger.Error("Failed to get health status", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "failed to get health status",
			"status": "unhealthy",
		})
		return
	}

	// Add system information
	systemInfo := h.getSystemInfo()

	// Get quantum backend details
	quantumDetails, _ := h.getQuantumBackendDetails(ctx)

	// Compile detailed status
	detailedStatus := map[string]interface{}{
		"status":           healthStatus.Status,
		"healthy":          healthStatus.Healthy,
		"service":          "quantumbeam-fraud-detection",
		"version":          h.version,
		"build_time":       h.buildTime,
		"uptime_seconds":   time.Since(h.startTime).Seconds(),
		"last_check":       healthStatus.LastCheck,
		"quantum":          healthStatus.QuantumAvailable,
		"database":         healthStatus.DatabaseHealthy,
		"cache":            healthStatus.CacheHealthy,
		"errors":           healthStatus.Errors,
		"system":           systemInfo,
		"quantum_backends": quantumDetails,
		"timestamp":        time.Now().UTC(),
	}

	// Add circuit breaker status
	if h.service.circuitBreaker != nil {
		detailedStatus["circuit_breaker"] = map[string]interface{}{
			"state": h.service.circuitBreaker.GetState().String(),
		}
	}

	// Add rate limiter status
	if h.service.rateLimiter != nil {
		detailedStatus["rate_limiter"] = map[string]interface{}{
			"enabled": true,
			"limit":   h.service.config.RateLimitPerSecond,
			"burst":   h.service.config.RateLimitBurst,
		}
	}

	httpStatus := http.StatusOK
	if !healthStatus.Healthy {
		httpStatus = http.StatusServiceUnavailable
	}

	c.JSON(httpStatus, detailedStatus)
}

// MetricsHealthCheck provides metrics-based health information
func (h *HealthHandler) MetricsHealthCheck(c *gin.Context) {
	if h.service.metrics == nil {
		c.JSON(http.StatusOK, gin.H{
			"metrics_enabled": false,
			"message":         "Metrics collection is not enabled",
		})
		return
	}

	// This is a simplified metrics endpoint
	// In production, use the Prometheus /metrics endpoint instead
	c.JSON(http.StatusOK, gin.H{
		"metrics_enabled": true,
		"message":         "Metrics are being collected. Use /metrics endpoint for Prometheus format",
		"endpoints": map[string]string{
			"prometheus": "/metrics",
			"health":     "/health",
		},
	})
}

// Helper methods

func (h *HealthHandler) checkQuantumBackend(ctx context.Context) (map[string]interface{}, error) {
	hardwareStatus, err := h.service.Service.quantumBackend.MonitorQuantumHardware(ctx)
	if err != nil {
		return map[string]interface{}{
			"available": false,
			"error":     err.Error(),
			"healthy":   false,
		}, err
	}

	return map[string]interface{}{
		"available":         hardwareStatus.AvailableBackends > 0,
		"total_backends":    hardwareStatus.TotalBackends,
		"available_backends": hardwareStatus.AvailableBackends,
		"avg_queue_time":    hardwareStatus.AverageQueueTime,
		"system_health":     hardwareStatus.SystemHealth,
		"healthy":           hardwareStatus.AvailableBackends > 0,
	}, nil
}

func (h *HealthHandler) checkMemoryUsage() map[string]interface{} {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Consider unhealthy if using more than 90% of allocated memory
	usagePercent := float64(m.Alloc) / float64(m.Sys) * 100
	healthy := usagePercent < 90

	return map[string]interface{}{
		"alloc_mb":       bToMb(m.Alloc),
		"total_alloc_mb": bToMb(m.TotalAlloc),
		"sys_mb":         bToMb(m.Sys),
		"num_gc":         m.NumGC,
		"usage_percent":  usagePercent,
		"healthy":        healthy,
	}
}

func (h *HealthHandler) getSystemInfo() map[string]interface{} {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return map[string]interface{}{
		"go_version":    runtime.Version(),
		"num_cpu":       runtime.NumCPU(),
		"num_goroutine": runtime.NumGoroutine(),
		"memory": map[string]interface{}{
			"alloc_mb":       bToMb(m.Alloc),
			"total_alloc_mb": bToMb(m.TotalAlloc),
			"sys_mb":         bToMb(m.Sys),
			"num_gc":         m.NumGC,
		},
	}
}

func (h *HealthHandler) getQuantumBackendDetails(ctx context.Context) (map[string]interface{}, error) {
	status, err := h.service.GetQuantumBackendStatus(ctx)
	if err != nil {
		return nil, err
	}

	backends := make([]map[string]interface{}, 0)
	for _, backend := range status.AvailableBackends {
		backends = append(backends, map[string]interface{}{
			"name":         backend.Name,
			"provider":     backend.Provider,
			"qubit_count":  backend.QubitCount,
			"is_simulator": backend.IsSimulator,
			"is_available": backend.IsAvailable,
			"queue_time":   backend.QueueTime,
			"error_rate":   backend.ErrorRate,
		})
	}

	return map[string]interface{}{
		"recommended_backend": status.RecommendedBackend,
		"backends":            backends,
		"queue_times":         status.QueueTimes,
	}, nil
}

func bToMb(b uint64) uint64 {
	return b / 1024 / 1024
}

// HealthMonitor continuously monitors service health
type HealthMonitor struct {
	handler       *HealthHandler
	logger        *zap.Logger
	checkInterval time.Duration
	alertThreshold int
	failureCount  int
	alertCallback func(status *HealthStatus)
}

// NewHealthMonitor creates a new health monitor
func NewHealthMonitor(handler *HealthHandler, logger *zap.Logger, checkInterval time.Duration) *HealthMonitor {
	return &HealthMonitor{
		handler:        handler,
		logger:         logger,
		checkInterval:  checkInterval,
		alertThreshold: 3, // Alert after 3 consecutive failures
	}
}

// Start begins continuous health monitoring
func (hm *HealthMonitor) Start(ctx context.Context) {
	ticker := time.NewTicker(hm.checkInterval)
	defer ticker.Stop()

	hm.logger.Info("Starting health monitor",
		zap.Duration("interval", hm.checkInterval))

	for {
		select {
		case <-ctx.Done():
			hm.logger.Info("Health monitor stopped")
			return
		case <-ticker.C:
			hm.performCheck(ctx)
		}
	}
}

// performCheck performs a health check
func (hm *HealthMonitor) performCheck(ctx context.Context) {
	checkCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	status, err := hm.handler.service.GetHealth(checkCtx)
	if err != nil {
		hm.logger.Error("Health check failed", zap.Error(err))
		hm.recordFailure(nil)
		return
	}

	if !status.Healthy {
		hm.logger.Warn("Service unhealthy",
			zap.String("status", status.Status),
			zap.Strings("errors", status.Errors))
		hm.recordFailure(status)
	} else {
		hm.resetFailureCount()
		hm.logger.Debug("Health check passed",
			zap.String("status", status.Status))
	}
}

// recordFailure records a health check failure
func (hm *HealthMonitor) recordFailure(status *HealthStatus) {
	hm.failureCount++

	if hm.failureCount >= hm.alertThreshold {
		hm.logger.Error("Health check failure threshold reached",
			zap.Int("failures", hm.failureCount),
			zap.Int("threshold", hm.alertThreshold))

		if hm.alertCallback != nil && status != nil {
			hm.alertCallback(status)
		}
	}
}

// resetFailureCount resets the failure counter
func (hm *HealthMonitor) resetFailureCount() {
	if hm.failureCount > 0 {
		hm.logger.Info("Service recovered",
			zap.Int("previous_failures", hm.failureCount))
		hm.failureCount = 0
	}
}

// SetAlertCallback sets a callback for health alerts
func (hm *HealthMonitor) SetAlertCallback(callback func(status *HealthStatus)) {
	hm.alertCallback = callback
}

// HealthCheckMiddleware provides middleware for health checks
func HealthCheckMiddleware(healthHandler *HealthHandler) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip health check for health endpoints
		if c.Request.URL.Path == "/health" ||
			c.Request.URL.Path == "/health/live" ||
			c.Request.URL.Path == "/health/ready" {
			c.Next()
			return
		}

		// Check if service is ready
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		status, err := healthHandler.service.GetHealth(ctx)
		if err != nil || !status.Healthy {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":  "service unavailable",
				"status": "unhealthy",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// HealthReporter generates health reports
type HealthReporter struct {
	handler *HealthHandler
	logger  *zap.Logger
}

// NewHealthReporter creates a new health reporter
func NewHealthReporter(handler *HealthHandler, logger *zap.Logger) *HealthReporter {
	return &HealthReporter{
		handler: handler,
		logger:  logger,
	}
}

// GenerateReport generates a comprehensive health report
func (hr *HealthReporter) GenerateReport(ctx context.Context) (string, error) {
	status, err := hr.handler.service.GetHealth(ctx)
	if err != nil {
		return "", err
	}

	quantumDetails, _ := hr.handler.getQuantumBackendDetails(ctx)
	systemInfo := hr.handler.getSystemInfo()

	report := map[string]interface{}{
		"timestamp":        time.Now().UTC(),
		"service":          "quantumbeam-fraud-detection",
		"version":          hr.handler.version,
		"build_time":       hr.handler.buildTime,
		"uptime_seconds":   time.Since(hr.handler.startTime).Seconds(),
		"health_status":    status,
		"system_info":      systemInfo,
		"quantum_backends": quantumDetails,
	}

	reportJSON, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}

	return string(reportJSON), nil
}

// SaveReport saves a health report to a file
func (hr *HealthReporter) SaveReport(ctx context.Context, filename string) error {
	report, err := hr.GenerateReport(ctx)
	if err != nil {
		return err
	}

	// In production, save to file system or cloud storage
	hr.logger.Info("Health report generated",
		zap.String("filename", filename),
		zap.Int("size", len(report)))

	return nil
}