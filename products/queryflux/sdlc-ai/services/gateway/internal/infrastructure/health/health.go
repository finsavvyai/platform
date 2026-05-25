//go:build ignore

package health

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"sort"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
)

// HealthStatus represents the health status of a component
type HealthStatus string

const (
	StatusHealthy    HealthStatus = "healthy"
	StatusUnhealthy  HealthStatus = "unhealthy"
	StatusDegraded   HealthStatus = "degraded"
	StatusUnknown    HealthStatus = "unknown"
	StatusNotChecked HealthStatus = "not_checked"
)

// CheckResult represents the result of a health check
type CheckResult struct {
	Name         string                 `json:"name"`
	Status       HealthStatus           `json:"status"`
	Message      string                 `json:"message,omitempty"`
	LastChecked  time.Time              `json:"last_checked"`
	Duration     time.Duration          `json:"duration"`
	Details      map[string]interface{} `json:"details,omitempty"`
	Error        string                 `json:"error,omitempty"`
	ComponentID  string                 `json:"component_id"`
	CheckVersion string                 `json:"check_version"`
}

// HealthReport represents a comprehensive health report
type HealthReport struct {
	Status       HealthStatus            `json:"status"`
	Timestamp    time.Time               `json:"timestamp"`
	Version      string                  `json:"version"`
	Uptime       time.Duration           `json:"uptime"`
	Checks       map[string]*CheckResult `json:"checks"`
	Summary      map[string]int          `json:"summary"`
	System       SystemInfo              `json:"system"`
	Metadata     map[string]interface{}  `json:"metadata"`
	Dependencies map[string]interface{}  `json:"dependencies,omitempty"`
}

// SystemInfo represents system information
type SystemInfo struct {
	GoVersion  string                 `json:"go_version"`
	OS         string                 `json:"os"`
	Arch       string                 `json:"arch"`
	NumCPU     int                    `json:"num_cpu"`
	Goroutines int                    `json:"goroutines"`
	Memory     MemoryInfo             `json:"memory"`
	HeapStats  runtime.MemStats       `json:"heap_stats"`
	Process    ProcessInfo            `json:"process"`
	Custom     map[string]interface{} `json:"custom,omitempty"`
}

// MemoryInfo represents memory information
type MemoryInfo struct {
	Alloc         uint64  `json:"alloc"`
	TotalAlloc    uint64  `json:"total_alloc"`
	Sys           uint64  `json:"sys"`
	NumGC         uint32  `json:"num_gc"`
	GCCPUFraction float64 `json:"gc_cpu_fraction"`
}

// ProcessInfo represents process information
type ProcessInfo struct {
	PID        int       `json:"pid"`
	StartTime  time.Time `json:"start_time"`
	Uptime     string    `json:"uptime"`
	WorkingDir string    `json:"working_dir"`
}

// HealthChecker interface for health check implementations
type HealthChecker interface {
	Name() string
	Check(ctx context.Context) *CheckResult
	IsEnabled() bool
	GetCheckInterval() time.Duration
	GetTimeout() time.Duration
}

// Registry manages health checkers
type Registry struct {
	checkers   map[string]HealthChecker
	results    map[string]*CheckResult
	mutex      sync.RWMutex
	config     *config.Config
	logger     *logrus.Entry
	tracer     trace.Tracer
	startTime  time.Time
	version    string
	instanceID string
}

// NewRegistry creates a new health check registry
func NewRegistry(config *config.Config) *Registry {
	return &Registry{
		checkers: make(map[string]HealthChecker),
		results:  make(map[string]*CheckResult),
		config:   config,
		logger: logrus.WithFields(logrus.Fields{
			"component": "health_registry",
		}),
		tracer:     otel.Tracer("health-checks"),
		startTime:  time.Now(),
		version:    config.Version,
		instanceID: config.InstanceID,
	}
}

// Register registers a health checker
func (r *Registry) Register(checker HealthChecker) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	name := checker.Name()
	r.checkers[name] = checker
	r.logger.WithField("checker", name).Info("Health checker registered")
}

// Unregister unregisters a health checker
func (r *Registry) Unregister(name string) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if _, exists := r.checkers[name]; exists {
		delete(r.checkers, name)
		delete(r.results, name)
		r.logger.WithField("checker", name).Info("Health checker unregistered")
	}
}

// CheckAll runs all health checks and returns a comprehensive report
func (r *Registry) CheckAll(ctx context.Context) *HealthReport {
	ctx, span := r.tracer.Start(ctx, "health.check_all")
	defer span.End()

	r.mutex.RLock()
	checkerNames := make([]string, 0, len(r.checkers))
	for name := range r.checkers {
		checkerNames = append(checkerNames, name)
	}
	r.mutex.RUnlock()

	sort.Strings(checkerNames) // Ensure consistent order

	results := make(map[string]*CheckResult)
	summary := make(map[string]int)
	overallStatus := StatusHealthy

	for _, name := range checkerNames {
		r.mutex.RLock()
		checker, exists := r.checkers[name]
		r.mutex.RUnlock()

		if !exists || !checker.IsEnabled() {
			result := &CheckResult{
				Name:         name,
				Status:       StatusNotChecked,
				LastChecked:  time.Now(),
				ComponentID:  r.instanceID,
				CheckVersion: r.version,
			}
			results[name] = result
			summary[string(StatusNotChecked)]++
			continue
		}

		result := r.runCheck(ctx, checker)
		results[name] = result
		summary[string(result.Status)]++

		// Determine overall status
		if result.Status == StatusUnhealthy {
			overallStatus = StatusUnhealthy
		} else if result.Status == StatusDegraded && overallStatus == StatusHealthy {
			overallStatus = StatusDegraded
		}
	}

	// Add system information
	systemInfo := r.getSystemInfo()

	// Build report
	report := &HealthReport{
		Status:    overallStatus,
		Timestamp: time.Now(),
		Version:   r.version,
		Uptime:    time.Since(r.startTime),
		Checks:    results,
		Summary:   summary,
		System:    systemInfo,
		Metadata: map[string]interface{}{
			"instance_id":    r.instanceID,
			"environment":    r.config.Environment,
			"checks_count":   len(checkerNames),
			"checks_enabled": summary[string(StatusHealthy)] + summary[string(StatusDegraded)] + summary[string(StatusUnhealthy)],
		},
	}

	return report
}

// Check runs a specific health check
func (r *Registry) Check(ctx context.Context, name string) *CheckResult {
	r.mutex.RLock()
	checker, exists := r.checkers[name]
	r.mutex.RUnlock()

	if !exists {
		return &CheckResult{
			Name:         name,
			Status:       StatusUnknown,
			Message:      "Health checker not found",
			LastChecked:  time.Now(),
			ComponentID:  r.instanceID,
			CheckVersion: r.version,
		}
	}

	if !checker.IsEnabled() {
		return &CheckResult{
			Name:         name,
			Status:       StatusNotChecked,
			Message:      "Health checker disabled",
			LastChecked:  time.Now(),
			ComponentID:  r.instanceID,
			CheckVersion: r.version,
		}
	}

	return r.runCheck(ctx, checker)
}

// GetResults returns cached health check results
func (r *Registry) GetResults() map[string]*CheckResult {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	results := make(map[string]*CheckResult)
	for name, result := range r.results {
		// Copy the result to avoid concurrent access issues
		results[name] = &CheckResult{
			Name:         result.Name,
			Status:       result.Status,
			Message:      result.Message,
			LastChecked:  result.LastChecked,
			Duration:     result.Duration,
			Details:      result.Details,
			Error:        result.Error,
			ComponentID:  result.ComponentID,
			CheckVersion: result.CheckVersion,
		}
	}
	return results
}

// runCheck runs a single health check with timeout and error handling
func (r *Registry) runCheck(ctx context.Context, checker HealthChecker) *CheckResult {
	ctx, span := r.tracer.Start(ctx, fmt.Sprintf("health.check.%s", checker.Name()))
	defer span.End()

	start := time.Now()

	// Apply timeout
	timeout := checker.GetTimeout()
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	result := checker.Check(ctx)
	duration := time.Since(start)

	// Ensure result has required fields
	if result == nil {
		result = &CheckResult{
			Name:         checker.Name(),
			Status:       StatusUnknown,
			Message:      "Health check returned nil",
			LastChecked:  time.Now(),
			ComponentID:  r.instanceID,
			CheckVersion: r.version,
		}
	}

	result.LastChecked = time.Now()
	result.Duration = duration
	result.ComponentID = r.instanceID
	result.CheckVersion = r.version

	// Cache the result
	r.mutex.Lock()
	r.results[checker.Name()] = result
	r.mutex.Unlock()

	// Log the result
	logLevel := logrus.InfoLevel
	switch result.Status {
	case StatusUnhealthy:
		logLevel = logrus.ErrorLevel
	case StatusDegraded:
		logLevel = logrus.WarnLevel
	case StatusUnknown:
		logLevel = logrus.WarnLevel
	}

	r.logger.WithFields(logrus.Fields{
		"checker":  result.Name,
		"status":   result.Status,
		"duration": duration.Milliseconds(),
	}).Log(logLevel, "Health check completed")

	return result
}

// getSystemInfo collects system information
func (r *Registry) getSystemInfo() SystemInfo {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	return SystemInfo{
		GoVersion:  runtime.Version(),
		OS:         runtime.GOOS,
		Arch:       runtime.GOARCH,
		NumCPU:     runtime.NumCPU(),
		Goroutines: runtime.NumGoroutine(),
		Memory: MemoryInfo{
			Alloc:         memStats.Alloc,
			TotalAlloc:    memStats.TotalAlloc,
			Sys:           memStats.Sys,
			NumGC:         memStats.NumGC,
			GCCPUFraction: memStats.GCCPUFraction,
		},
		HeapStats: memStats,
		Process: ProcessInfo{
			PID:        0, // TODO: Get actual PID
			StartTime:  r.startTime,
			Uptime:     time.Since(r.startTime).String(),
			WorkingDir: "", // TODO: Get working directory
		},
		Custom: make(map[string]interface{}),
	}
}

// Built-in health checkers

// DatabaseChecker checks database connectivity
type DatabaseChecker struct {
	db     *database.Connection
	config DatabaseConfig
}

type DatabaseConfig struct {
	Enabled        bool          `yaml:"enabled"`
	CheckInterval  time.Duration `yaml:"check_interval"`
	Timeout        time.Duration `yaml:"timeout"`
	QueryTimeout   time.Duration `yaml:"query_timeout"`
	TestQuery      string        `yaml:"test_query"`
	IncludeMetrics bool          `yaml:"include_metrics"`
}

func NewDatabaseChecker(db *database.Connection, config DatabaseConfig) *DatabaseChecker {
	return &DatabaseChecker{
		db:     db,
		config: config,
	}
}

func (dc *DatabaseChecker) Name() string {
	return "database"
}

func (dc *DatabaseChecker) IsEnabled() bool {
	return dc.config.Enabled
}

func (dc *DatabaseChecker) GetCheckInterval() time.Duration {
	return dc.config.CheckInterval
}

func (dc *DatabaseChecker) GetTimeout() time.Duration {
	return dc.config.Timeout
}

func (dc *DatabaseChecker) Check(ctx context.Context) *CheckResult {
	result := &CheckResult{
		Name:    dc.Name(),
		Status:  StatusHealthy,
		Details: make(map[string]interface{}),
	}

	start := time.Now()

	// Basic connectivity check
	if err := dc.db.Ping(ctx); err != nil {
		result.Status = StatusUnhealthy
		result.Message = "Database ping failed"
		result.Error = err.Error()
		return result
	}

	// Test query if configured
	if dc.config.TestQuery != "" {
		queryCtx, cancel := context.WithTimeout(ctx, dc.config.QueryTimeout)
		defer cancel()

		queryStart := time.Now()
		if err := dc.db.TestQuery(queryCtx, dc.config.TestQuery); err != nil {
			result.Status = StatusDegraded
			result.Message = "Database test query failed"
			result.Error = err.Error()
			return result
		}
		result.Details["test_query_duration"] = time.Since(queryStart).Milliseconds()
	}

	// Include metrics if configured
	if dc.config.IncludeMetrics {
		stats := dc.db.Stats()
		result.Details["connection_pool"] = map[string]interface{}{
			"max_connections":     stats.MaxConns(),
			"current_connections": stats.TotalConns(),
			"idle_connections":    stats.IdleConns(),
			"acquire_count":       stats.AcquireCount(),
			"acquire_duration":    stats.AcquireDuration().String(),
		}
	}

	result.Message = "Database is healthy"
	result.Details["ping_duration"] = time.Since(start).Milliseconds()

	return result
}

// CircuitBreakerChecker checks circuit breaker status
type CircuitBreakerChecker struct {
	registry *circuitbreaker.Registry
	config   CircuitBreakerConfig
}

type CircuitBreakerConfig struct {
	Enabled       bool          `yaml:"enabled"`
	CheckInterval time.Duration `yaml:"check_interval"`
	Timeout       time.Duration `yaml:"timeout"`
	WarnThreshold float64       `yaml:"warn_threshold"`
}

func NewCircuitBreakerChecker(registry *circuitbreaker.Registry, config CircuitBreakerConfig) *CircuitBreakerChecker {
	return &CircuitBreakerChecker{
		registry: registry,
		config:   config,
	}
}

func (cbc *CircuitBreakerChecker) Name() string {
	return "circuit_breakers"
}

func (cbc *CircuitBreakerChecker) IsEnabled() bool {
	return cbc.config.Enabled
}

func (cbc *CircuitBreakerChecker) GetCheckInterval() time.Duration {
	return cbc.config.CheckInterval
}

func (cbc *CircuitBreakerChecker) GetTimeout() time.Duration {
	return cbc.config.Timeout
}

func (cbc *CircuitBreakerChecker) Check(ctx context.Context) *CheckResult {
	result := &CheckResult{
		Name:    cbc.Name(),
		Status:  StatusHealthy,
		Details: make(map[string]interface{}),
	}

	metrics := cbc.registry.GetAllMetrics()
	openBreakers := 0
	totalRequests := uint64(0)
	failedRequests := uint64(0)

	breakerDetails := make(map[string]interface{})
	for name, metric := range metrics {
		totalRequests += metric.TotalRequests
		failedRequests += metric.FailedRequests

		if metric.CurrentState == circuitbreaker.StateOpen {
			openBreakers++
		}

		breakerDetails[name] = map[string]interface{}{
			"state":                metric.CurrentState.String(),
			"total_requests":       metric.TotalRequests,
			"successful_requests":  metric.SuccessfulRequests,
			"failed_requests":      metric.FailedRequests,
			"success_rate_percent": calculateSuccessRate(metric.SuccessfulRequests, metric.TotalRequests),
			"state_changes":        metric.StateChanges,
			"uptime":               metric.Uptime.String(),
		}
	}

	result.Details["breakers"] = breakerDetails
	result.Details["total_breakers"] = len(metrics)
	result.Details["open_breakers"] = openBreakers

	if totalRequests > 0 {
		failureRate := float64(failedRequests) / float64(totalRequests) * 100
		result.Details["overall_failure_rate_percent"] = failureRate

		if failureRate > cbc.config.WarnThreshold {
			result.Status = StatusDegraded
			result.Message = fmt.Sprintf("High failure rate: %.2f%%", failureRate)
		}
	}

	if openBreakers > 0 {
		if result.Status == StatusHealthy {
			result.Status = StatusDegraded
		}
		result.Message = fmt.Sprintf("%d circuit breakers open", openBreakers)
	}

	if result.Status == StatusHealthy {
		result.Message = "All circuit breakers are healthy"
	}

	return result
}

// MemoryChecker checks memory usage
type MemoryChecker struct {
	config MemoryConfig
}

type MemoryConfig struct {
	Enabled           bool          `yaml:"enabled"`
	CheckInterval     time.Duration `yaml:"check_interval"`
	Timeout           time.Duration `yaml:"timeout"`
	WarningThreshold  float64       `yaml:"warning_threshold"`  // Percentage
	CriticalThreshold float64       `yaml:"critical_threshold"` // Percentage
}

func NewMemoryChecker(config MemoryConfig) *MemoryChecker {
	return &MemoryChecker{config: config}
}

func (mc *MemoryChecker) Name() string {
	return "memory"
}

func (mc *MemoryChecker) IsEnabled() bool {
	return mc.config.Enabled
}

func (mc *MemoryChecker) GetCheckInterval() time.Duration {
	return mc.config.CheckInterval
}

func (mc *MemoryChecker) GetTimeout() time.Duration {
	return mc.config.Timeout
}

func (mc *MemoryChecker) Check(ctx context.Context) *CheckResult {
	result := &CheckResult{
		Name:    mc.Name(),
		Status:  StatusHealthy,
		Details: make(map[string]interface{}),
	}

	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Calculate memory usage percentage (approximation)
	memUsagePercent := float64(memStats.Alloc) / float64(memStats.Sys) * 100

	result.Details["alloc_bytes"] = memStats.Alloc
	result.Details["sys_bytes"] = memStats.Sys
	result.Details["total_alloc_bytes"] = memStats.TotalAlloc
	result.Details["num_gc"] = memStats.NumGC
	result.Details["goroutines"] = runtime.NumGoroutine()
	result.Details["usage_percent"] = memUsagePercent

	if memUsagePercent > mc.config.CriticalThreshold {
		result.Status = StatusUnhealthy
		result.Message = fmt.Sprintf("Critical memory usage: %.2f%%", memUsagePercent)
	} else if memUsagePercent > mc.config.WarningThreshold {
		result.Status = StatusDegraded
		result.Message = fmt.Sprintf("High memory usage: %.2f%%", memUsagePercent)
	} else {
		result.Message = fmt.Sprintf("Memory usage is normal: %.2f%%", memUsagePercent)
	}

	return result
}

// calculateSuccessRate calculates the success rate as a percentage
func calculateSuccessRate(successful, total uint64) float64 {
	if total == 0 {
		return 0.0
	}
	return float64(successful) / float64(total) * 100.0
}

// HTTPHandler provides HTTP endpoints for health checks
type HTTPHandler struct {
	registry *Registry
	logger   *logrus.Entry
}

// NewHTTPHandler creates a new HTTP handler for health checks
func NewHTTPHandler(registry *Registry) *HTTPHandler {
	return &HTTPHandler{
		registry: registry,
		logger: logrus.WithFields(logrus.Fields{
			"component": "health_http_handler",
		}),
	}
}

// ServeHTTP serves health check HTTP requests
func (h *HTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Add correlation ID to context
	ctx := r.Context()
	if requestID := r.Header.Get("X-Request-ID"); requestID != "" {
		observability.SetAttributes(ctx, "http", map[string]interface{}{
			"request_id": requestID,
		})
	}

	// Determine which check to run
	checkName := r.URL.Query().Get("check")

	var report *HealthReport
	if checkName != "" {
		result := h.registry.Check(ctx, checkName)
		report = &HealthReport{
			Status:    result.Status,
			Timestamp: time.Now(),
			Version:   h.registry.version,
			Uptime:    time.Since(h.registry.startTime),
			Checks:    map[string]*CheckResult{checkName: result},
			Summary:   map[string]int{string(result.Status): 1},
			System:    h.registry.getSystemInfo(),
		}
	} else {
		report = h.registry.CheckAll(ctx)
	}

	// Set appropriate status code
	statusCode := http.StatusOK
	switch report.Status {
	case StatusUnhealthy:
		statusCode = http.StatusServiceUnavailable
	case StatusDegraded:
		statusCode = 207 // Multi-Status
	}

	// Write response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(report); err != nil {
		h.logger.WithError(err).Error("Failed to encode health report")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Log the health check
	h.logger.WithFields(logrus.Fields{
		"status":      report.Status,
		"status_code": statusCode,
		"checks":      len(report.Checks),
	}).Info("Health check completed")
}

// Global registry instance
var globalRegistry *Registry

// InitializeGlobalHealth initializes the global health check registry
func InitializeGlobalHealth(cfg *config.Config, db *database.Connection) *Registry {
	registry := NewRegistry(cfg)

	// Register built-in checkers
	registry.Register(NewDatabaseChecker(db, DatabaseConfig{
		Enabled:        true,
		CheckInterval:  30 * time.Second,
		Timeout:        5 * time.Second,
		QueryTimeout:   2 * time.Second,
		TestQuery:      "SELECT 1",
		IncludeMetrics: true,
	}))

	registry.Register(NewCircuitBreakerChecker(
		circuitbreaker.GetGlobalRegistry(),
		CircuitBreakerConfig{
			Enabled:       true,
			CheckInterval: 30 * time.Second,
			Timeout:       2 * time.Second,
			WarnThreshold: 10.0, // 10% failure rate warning
		},
	))

	registry.Register(NewMemoryChecker(MemoryConfig{
		Enabled:           true,
		CheckInterval:     60 * time.Second,
		Timeout:           1 * time.Second,
		WarningThreshold:  80.0, // 80% memory usage warning
		CriticalThreshold: 90.0, // 90% memory usage critical
	}))

	globalRegistry = registry
	return registry
}

// GetGlobalRegistry returns the global health check registry
func GetGlobalRegistry() *Registry {
	return globalRegistry
}
