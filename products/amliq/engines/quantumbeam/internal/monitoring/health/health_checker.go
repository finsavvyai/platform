//go:build legacy_migrated
// +build legacy_migrated

package health

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

// HealthStatus represents the health status of a component
type HealthStatus string

const (
	StatusHealthy   HealthStatus = "healthy"
	StatusUnhealthy HealthStatus = "unhealthy"
	StatusDegraded  HealthStatus = "degraded"
	StatusUnknown   HealthStatus = "unknown"
)

// ComponentHealth represents the health status of a component
type ComponentHealth struct {
	Name         string                 `json:"name"`
	Status       HealthStatus           `json:"status"`
	Message      string                 `json:"message,omitempty"`
	LastChecked  time.Time              `json:"last_checked"`
	ResponseTime time.Duration          `json:"response_time"`
	Details      map[string]interface{} `json:"details,omitempty"`
}

// SystemHealth represents the overall system health
type SystemHealth struct {
	Status     HealthStatus               `json:"status"`
	Timestamp  time.Time                  `json:"timestamp"`
	Version    string                     `json:"version"`
	BuildInfo  BuildInfo                  `json:"build_info"`
	Components map[string]ComponentHealth `json:"components"`
	Uptime     time.Duration              `json:"uptime"`
	Checks     map[string]bool            `json:"checks"`
	Summary    HealthSummary              `json:"summary"`
}

// BuildInfo contains build information
type BuildInfo struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildTime string `json:"build_time"`
	GoVersion string `json:"go_version"`
	Platform  string `json:"platform"`
}

// HealthSummary contains a summary of health checks
type HealthSummary struct {
	Total     int `json:"total"`
	Healthy   int `json:"healthy"`
	Degraded  int `json:"degraded"`
	Unhealthy int `json:"unhealthy"`
	Unknown   int `json:"unknown"`
}

// HealthChecker manages health checks for system components
type HealthChecker struct {
	startTime time.Time
	buildInfo BuildInfo
	checks    map[string]HealthCheck
	results   map[string]ComponentHealth
	resultsMu sync.RWMutex
	tracer    trace.Tracer
	metrics   *HealthMetrics
	config    HealthConfig
}

// HealthCheck represents a health check function
type HealthCheck struct {
	Name        string
	Check       func(ctx context.Context) ComponentHealth
	Interval    time.Duration
	Timeout     time.Duration
	Critical    bool
	Enabled     bool
	LastChecked time.Time
}

// HealthConfig contains configuration for health checking
type HealthConfig struct {
	Enabled           bool          `json:"enabled"`
	CheckInterval     time.Duration `json:"check_interval"`
	DefaultTimeout    time.Duration `json:"default_timeout"`
	CriticalThreshold int           `json:"critical_threshold"`
	IncludeMetrics    bool          `json:"include_metrics"`
	IncludeBuildInfo  bool          `json:"include_build_info"`
}

// HealthMetrics contains health-related metrics
type HealthMetrics struct {
	CheckDuration   prometheus.Histogram
	CheckTotal      prometheus.Counter
	CheckErrors     prometheus.Counter
	ComponentStatus prometheus.Gauge
	SystemStatus    prometheus.Gauge
}

// NewHealthMetrics creates new health metrics
func NewHealthMetrics() *HealthMetrics {
	return &HealthMetrics{
		CheckDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "health_check_duration_seconds",
				Help:    "Duration of health checks",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"component"},
		),
		CheckTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "health_checks_total",
				Help: "Total number of health checks",
			},
			[]string{"component", "status"},
		),
		CheckErrors: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "health_check_errors_total",
				Help: "Total number of health check errors",
			},
			[]string{"component"},
		),
		ComponentStatus: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "health_component_status",
				Help: "Health status of components (1=healthy, 0.5=degraded, 0=unhealthy, -1=unknown)",
			},
			[]string{"component"},
		),
		SystemStatus: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "health_system_status",
			Help: "Overall system health status (1=healthy, 0.5=degraded, 0=unhealthy, -1=unknown)",
		}),
	}
}

// RegisterMetrics registers health metrics
func (m *HealthMetrics) RegisterMetrics() error {
	metrics := []prometheus.Collector{
		m.CheckDuration,
		m.CheckTotal,
		m.CheckErrors,
		m.ComponentStatus,
		m.SystemStatus,
	}

	for _, metric := range metrics {
		if err := prometheus.Register(metric); err != nil {
			if _, ok := err.(prometheus.AlreadyRegisteredError); !ok {
				return err
			}
		}
	}

	return nil
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(config HealthConfig, buildInfo BuildInfo) *HealthChecker {
	hc := &HealthChecker{
		startTime: time.Now(),
		buildInfo: buildInfo,
		checks:    make(map[string]HealthCheck),
		results:   make(map[string]ComponentHealth),
		tracer:    otel.Tracer("health-checker"),
		metrics:   NewHealthMetrics(),
		config:    config,
	}

	// Register metrics
	if err := hc.metrics.RegisterMetrics(); err != nil {
		fmt.Printf("Failed to register health metrics: %v\n", err)
	}

	// Add default checks
	hc.addDefaultChecks()

	return hc
}

// addDefaultChecks adds default health checks
func (hc *HealthChecker) addDefaultChecks() {
	// Runtime check
	hc.AddCheck(HealthCheck{
		Name:     "runtime",
		Check:    hc.checkRuntime,
		Interval: 30 * time.Second,
		Timeout:  5 * time.Second,
		Critical: true,
		Enabled:  true,
	})

	// Memory check
	hc.AddCheck(HealthCheck{
		Name:     "memory",
		Check:    hc.checkMemory,
		Interval: 30 * time.Second,
		Timeout:  5 * time.Second,
		Critical: true,
		Enabled:  true,
	})

	// Goroutine check
	hc.AddCheck(HealthCheck{
		Name:     "goroutines",
		Check:    hc.checkGoroutines,
		Interval: 30 * time.Second,
		Timeout:  5 * time.Second,
		Critical: false,
		Enabled:  true,
	})
}

// AddCheck adds a health check
func (hc *HealthChecker) AddCheck(check HealthCheck) {
	hc.checks[check.Name] = check
}

// RemoveCheck removes a health check
func (hc *HealthChecker) RemoveCheck(name string) {
	delete(hc.checks, name)
	delete(hc.results, name)
}

// CheckHealth performs all health checks
func (hc *HealthChecker) CheckHealth(ctx context.Context) SystemHealth {
	ctx, span := hc.tracer.Start(ctx, "health_check")
	defer span.End()

	hc.resultsMu.Lock()
	defer hc.resultsMu.Unlock()

	// Run all enabled checks
	for name, check := range hc.checks {
		if !check.Enabled {
			continue
		}

		// Check if interval has passed
		if time.Since(check.LastChecked) < check.Interval {
			continue
		}

		// Run check with timeout
		checkCtx, cancel := context.WithTimeout(ctx, check.Timeout)
		result := hc.runCheck(checkCtx, check)
		cancel()

		hc.results[name] = result
		check.LastChecked = time.Now()
		hc.checks[name] = check
	}

	// Calculate overall health
	return hc.calculateSystemHealth()
}

// runCheck runs a single health check
func (hc *HealthChecker) runCheck(ctx context.Context, check HealthCheck) ComponentHealth {
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		hc.metrics.CheckDuration.WithLabelValues(check.Name).Observe(duration.Seconds())
	}()

	result := check.Check(ctx)
	result.LastChecked = time.Now()

	// Record metrics
	statusLabel := string(result.Status)
	hc.metrics.CheckTotal.WithLabelValues(check.Name, statusLabel).Inc()

	if result.Status == StatusUnhealthy {
		hc.metrics.CheckErrors.WithLabelValues(check.Name).Inc()
	}

	// Update component status gauge
	statusValue := hc.statusToGaugeValue(result.Status)
	hc.metrics.ComponentStatus.WithLabelValues(check.Name).Set(statusValue)

	return result
}

// statusToGaugeValue converts health status to gauge value
func (hc *HealthChecker) statusToGaugeValue(status HealthStatus) float64 {
	switch status {
	case StatusHealthy:
		return 1.0
	case StatusDegraded:
		return 0.5
	case StatusUnhealthy:
		return 0.0
	default:
		return -1.0
	}
}

// calculateSystemHealth calculates overall system health
func (hc *HealthChecker) calculateSystemHealth() SystemHealth {
	components := make(map[string]ComponentHealth)
	for name, result := range hc.results {
		components[name] = result
	}

	summary := hc.calculateSummary(components)
	overallStatus := hc.calculateOverallStatus(summary, components)

	checks := make(map[string]bool)
	for name, component := range components {
		checks[name] = component.Status == StatusHealthy
	}

	return SystemHealth{
		Status:     overallStatus,
		Timestamp:  time.Now(),
		Version:    hc.buildInfo.Version,
		BuildInfo:  hc.buildInfo,
		Components: components,
		Uptime:     time.Since(hc.startTime),
		Checks:     checks,
		Summary:    summary,
	}
}

// calculateSummary calculates a summary of component health
func (hc *HealthChecker) calculateSummary(components map[string]ComponentHealth) HealthSummary {
	summary := HealthSummary{}
	for _, component := range components {
		summary.Total++
		switch component.Status {
		case StatusHealthy:
			summary.Healthy++
		case StatusDegraded:
			summary.Degraded++
		case StatusUnhealthy:
			summary.Unhealthy++
		default:
			summary.Unknown++
		}
	}
	return summary
}

// calculateOverallStatus calculates overall system status
func (hc *HealthChecker) calculateOverallStatus(summary HealthSummary, components map[string]ComponentHealth) HealthStatus {
	// Check critical components
	for name, component := range components {
		if check, exists := hc.checks[name]; exists && check.Critical {
			if component.Status == StatusUnhealthy {
				return StatusUnhealthy
			}
		}
	}

	// If all components are healthy
	if summary.Unhealthy == 0 && summary.Degraded == 0 {
		return StatusHealthy
	}

	// If any unhealthy components exist
	if summary.Unhealthy > 0 {
		return StatusDegraded
	}

	// If degraded components exist
	if summary.Degraded > 0 {
		return StatusDegraded
	}

	return StatusUnknown
}

// GetHealth returns current system health
func (hc *HealthChecker) GetHealth(ctx context.Context) SystemHealth {
	return hc.CheckHealth(ctx)
}

// GetComponentHealth returns health of a specific component
func (hc *HealthChecker) GetComponentHealth(name string) (ComponentHealth, bool) {
	hc.resultsMu.RLock()
	defer hc.resultsMu.RUnlock()
	result, exists := hc.results[name]
	return result, exists
}

// Start starts the health checker
func (hc *HealthChecker) Start(ctx context.Context) {
	if !hc.config.Enabled {
		return
	}

	ticker := time.NewTicker(hc.config.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			hc.CheckHealth(ctx)
		}
	}
}

// Default health check implementations

func (hc *HealthChecker) checkRuntime(ctx context.Context) ComponentHealth {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return ComponentHealth{
		Name:         "runtime",
		Status:       StatusHealthy,
		Message:      "Runtime is functioning normally",
		ResponseTime: time.Duration(0),
		Details: map[string]interface{}{
			"goroutines":      runtime.NumGoroutine(),
			"heap_alloc":      m.HeapAlloc,
			"heap_sys":        m.HeapSys,
			"gc_cpu_fraction": m.GCCPUFraction,
			"num_gc":          m.NumGC,
			"go_version":      runtime.Version(),
		},
	}
}

func (hc *HealthChecker) checkMemory(ctx context.Context) ComponentHealth {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Check memory usage (threshold: 1GB)
	const memoryThreshold = 1024 * 1024 * 1024 // 1GB
	status := StatusHealthy
	message := "Memory usage is normal"

	if m.Alloc > memoryThreshold {
		status = StatusDegraded
		message = "High memory usage detected"
	}

	return ComponentHealth{
		Name:         "memory",
		Status:       status,
		Message:      message,
		ResponseTime: time.Duration(0),
		Details: map[string]interface{}{
			"alloc_mb":      m.Alloc / 1024 / 1024,
			"sys_mb":        m.Sys / 1024 / 1024,
			"heap_alloc_mb": m.HeapAlloc / 1024 / 1024,
			"heap_sys_mb":   m.HeapSys / 1024 / 1024,
		},
	}
}

func (hc *HealthChecker) checkGoroutines(ctx context.Context) ComponentHealth {
	count := runtime.NumGoroutine()

	// Check goroutine count (threshold: 1000)
	const goroutineThreshold = 1000
	status := StatusHealthy
	message := "Goroutine count is normal"

	if count > goroutineThreshold {
		status = StatusDegraded
		message = "High goroutine count detected"
	}

	return ComponentHealth{
		Name:         "goroutines",
		Status:       status,
		Message:      message,
		ResponseTime: time.Duration(0),
		Details: map[string]interface{}{
			"count": count,
		},
	}
}

// Database health check

func (hc *HealthChecker) AddDatabaseCheck(name string, db *sql.DB) {
	hc.AddCheck(HealthCheck{
		Name:     name,
		Check:    func(ctx context.Context) ComponentHealth { return hc.checkDatabase(ctx, db, name) },
		Interval: 30 * time.Second,
		Timeout:  10 * time.Second,
		Critical: true,
		Enabled:  true,
	})
}

func (hc *HealthChecker) checkDatabase(ctx context.Context, db *sql.DB, name string) ComponentHealth {
	start := time.Now()

	err := db.PingContext(ctx)
	responseTime := time.Since(start)

	if err != nil {
		return ComponentHealth{
			Name:         name,
			Status:       StatusUnhealthy,
			Message:      fmt.Sprintf("Database connection failed: %v", err),
			LastChecked:  time.Now(),
			ResponseTime: responseTime,
			Details: map[string]interface{}{
				"error": err.Error(),
			},
		}
	}

	// Get database stats
	stats := db.Stats()

	status := StatusHealthy
	message := "Database is healthy"

	if responseTime > 5*time.Second {
		status = StatusDegraded
		message = "Database response time is high"
	}

	return ComponentHealth{
		Name:         name,
		Status:       status,
		Message:      message,
		LastChecked:  time.Now(),
		ResponseTime: responseTime,
		Details: map[string]interface{}{
			"open_connections":    stats.OpenConnections,
			"in_use":              stats.InUse,
			"idle":                stats.Idle,
			"wait_count":          stats.WaitCount,
			"wait_duration":       stats.WaitDuration.String(),
			"max_idle_closed":     stats.MaxIdleClosed,
			"max_lifetime_closed": stats.MaxLifetimeClosed,
		},
	}
}

// Redis health check

func (hc *HealthChecker) AddRedisCheck(name string, client *redis.Client) {
	hc.AddCheck(HealthCheck{
		Name:     name,
		Check:    func(ctx context.Context) ComponentHealth { return hc.checkRedis(ctx, client, name) },
		Interval: 30 * time.Second,
		Timeout:  10 * time.Second,
		Critical: true,
		Enabled:  true,
	})
}

func (hc *HealthChecker) checkRedis(ctx context.Context, client *redis.Client, name string) ComponentHealth {
	start := time.Now()

	result := client.Ping(ctx)
	responseTime := time.Since(start)

	if result.Err() != nil {
		return ComponentHealth{
			Name:         name,
			Status:       StatusUnhealthy,
			Message:      fmt.Sprintf("Redis connection failed: %v", result.Err()),
			LastChecked:  time.Now(),
			ResponseTime: responseTime,
			Details: map[string]interface{}{
				"error": result.Err().Error(),
			},
		}
	}

	status := StatusHealthy
	message := "Redis is healthy"

	if responseTime > 2*time.Second {
		status = StatusDegraded
		message = "Redis response time is high"
	}

	return ComponentHealth{
		Name:         name,
		Status:       status,
		Message:      message,
		LastChecked:  time.Now(),
		ResponseTime: responseTime,
		Details: map[string]interface{}{
			"response":         result.Val(),
			"response_time_ms": responseTime.Milliseconds(),
		},
	}
}

// HTTP health check

func (hc *HealthChecker) AddHTTPCheck(name, url string, expectedStatus int) {
	hc.AddCheck(HealthCheck{
		Name:     name,
		Check:    func(ctx context.Context) ComponentHealth { return hc.checkHTTP(ctx, url, expectedStatus, name) },
		Interval: 30 * time.Second,
		Timeout:  10 * time.Second,
		Critical: false,
		Enabled:  true,
	})
}

func (hc *HealthChecker) checkHTTP(ctx context.Context, url string, expectedStatus int, name string) ComponentHealth {
	start := time.Now()

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return ComponentHealth{
			Name:         name,
			Status:       StatusUnhealthy,
			Message:      fmt.Sprintf("Failed to create request: %v", err),
			LastChecked:  time.Now(),
			ResponseTime: time.Since(start),
		}
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	responseTime := time.Since(start)

	if err != nil {
		return ComponentHealth{
			Name:         name,
			Status:       StatusUnhealthy,
			Message:      fmt.Sprintf("HTTP request failed: %v", err),
			LastChecked:  time.Now(),
			ResponseTime: responseTime,
			Details: map[string]interface{}{
				"url":   url,
				"error": err.Error(),
			},
		}
	}
	defer resp.Body.Close()

	status := StatusHealthy
	message := "HTTP endpoint is healthy"

	if resp.StatusCode != expectedStatus {
		status = StatusDegraded
		message = fmt.Sprintf("Unexpected status code: %d (expected: %d)", resp.StatusCode, expectedStatus)
	}

	return ComponentHealth{
		Name:         name,
		Status:       status,
		Message:      message,
		LastChecked:  time.Now(),
		ResponseTime: responseTime,
		Details: map[string]interface{}{
			"url":           url,
			"status_code":   resp.StatusCode,
			"expected_code": expectedStatus,
		},
	}
}

// ToJSON converts system health to JSON
func (sh *SystemHealth) ToJSON() ([]byte, error) {
	return json.MarshalIndent(sh, "", "  ")
}

// HTTPHandler returns an HTTP handler for health checks
func (hc *HealthChecker) HTTPHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		health := hc.GetHealth(ctx)

		// Set appropriate status code
		statusCode := http.StatusOK
		if health.Status == StatusUnhealthy {
			statusCode = http.StatusServiceUnavailable
		} else if health.Status == StatusDegraded {
			statusCode = 200 // Still return 200 for degraded but include info
		}

		// Set headers
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")

		// Return response
		w.WriteHeader(statusCode)

		if err := json.NewEncoder(w).Encode(health); err != nil {
			http.Error(w, "Failed to encode health response", http.StatusInternalServerError)
			return
		}
	}
}

// ReadinessHandler returns an HTTP handler for readiness checks
func (hc *HealthChecker) ReadinessHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		health := hc.GetHealth(ctx)

		// Check if critical components are healthy
		allCriticalHealthy := true
		for name, component := range health.Components {
			if check, exists := hc.checks[name]; exists && check.Critical {
				if component.Status != StatusHealthy {
					allCriticalHealthy = false
					break
				}
			}
		}

		statusCode := http.StatusOK
		status := "ready"
		if !allCriticalHealthy {
			statusCode = http.StatusServiceUnavailable
			status = "not_ready"
		}

		response := map[string]interface{}{
			"status":    status,
			"timestamp": time.Now().UTC(),
			"checks":    health.Checks,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		json.NewEncoder(w).Encode(response)
	}
}