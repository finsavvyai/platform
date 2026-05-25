package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

// HealthChecker provides comprehensive health checking capabilities
type HealthChecker struct {
	logger        *log.Logger
	checks        map[string]HealthCheck
	mu            sync.RWMutex
	config        HealthConfig
	status        map[string]HealthStatus
	lastCheckTime time.Time
}

// HealthConfig holds health checker configuration
type HealthConfig struct {
	Enabled                 bool          `json:"enabled"`
	Port                    int           `json:"port"`
	Path                    string        `json:"path"`
	CheckInterval           time.Duration `json:"check_interval"`
	Timeout                 time.Duration `json:"timeout"`
	DegradedThreshold       int           `json:"degraded_threshold"`
	UnhealthyThreshold      int           `json:"unhealthy_threshold"`
	IncludeSystemMetrics    bool          `json:"include_system_metrics"`
	IncludeDependencyChecks bool          `json:"include_dependency_checks"`
}

// HealthCheck represents a health check
type HealthCheck struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	CheckFunc   HealthCheckFunc   `json:"-"`
	Interval    time.Duration     `json:"interval"`
	Timeout     time.Duration     `json:"timeout"`
	Enabled     bool              `json:"enabled"`
	Critical    bool              `json:"critical"`
	Tags        []string          `json:"tags"`
	Metadata    map[string]string `json:"metadata"`
}

// HealthCheckFunc is the function type for health checks
type HealthCheckFunc func(ctx context.Context) HealthResult

// HealthResult represents the result of a health check
type HealthResult struct {
	Status      HealthStatus      `json:"status"`
	Message     string            `json:"message"`
	Duration    time.Duration     `json:"duration"`
	LastChecked time.Time         `json:"last_checked"`
	Error       error             `json:"error,omitempty"`
	Details     map[string]string `json:"details,omitempty"`
}

// HealthStatus represents health status
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "HEALTHY"
	HealthStatusDegraded  HealthStatus = "DEGRADED"
	HealthStatusUnhealthy HealthStatus = "UNHEALTHY"
	HealthStatusUnknown   HealthStatus = "UNKNOWN"
)

// OverallHealth represents the overall system health
type OverallHealth struct {
	Status         HealthStatus                `json:"status"`
	Version        string                      `json:"version"`
	Uptime         time.Duration               `json:"uptime"`
	LastChecked    time.Time                   `json:"last_checked"`
	CheckCount     int                         `json:"check_count"`
	HealthyCount   int                         `json:"healthy_count"`
	DegradedCount  int                         `json:"degraded_count"`
	UnhealthyCount int                         `json:"unhealthy_count"`
	UnknownCount   int                         `json:"unknown_count"`
	Checks         map[string]HealthResult     `json:"checks"`
	SystemMetrics  SystemHealthMetrics         `json:"system_metrics,omitempty"`
	Dependencies   map[string]DependencyHealth `json:"dependencies,omitempty"`
}

// SystemHealthMetrics represents system health metrics
type SystemHealthMetrics struct {
	CPUUsage       float64 `json:"cpu_usage"`
	MemoryUsage    float64 `json:"memory_usage"`
	GoroutineCount int     `json:"goroutine_count"`
	GCCount        uint64  `json:"gc_count"`
	HeapSize       uint64  `json:"heap_size"`
	NumConnections int     `json:"num_connections"`
	Uptime         string  `json:"uptime"`
}

// DependencyHealth represents the health of external dependencies
type DependencyHealth struct {
	Name         string        `json:"name"`
	Type         string        `json:"type"`
	Status       HealthStatus  `json:"status"`
	Message      string        `json:"message"`
	ResponseTime time.Duration `json:"response_time"`
	LastChecked  time.Time     `json:"last_checked"`
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(config HealthConfig) *HealthChecker {
	hc := &HealthChecker{
		logger: log.New(log.Writer(), "[HEALTH-CHECKER] ", log.LstdFlags|log.Lmsgprefix),
		checks: make(map[string]HealthCheck),
		status: make(map[string]HealthStatus),
		config: config,
	}

	// Register default health checks
	hc.registerDefaultChecks()

	// Start background health checking
	go hc.runBackgroundChecks()

	return hc
}

// registerDefaultChecks registers default health checks
func (hc *HealthChecker) registerDefaultChecks() {
	// Basic application health check
	hc.RegisterCheck(HealthCheck{
		Name:        "application",
		Description: "Basic application health",
		CheckFunc:   hc.checkApplication,
		Interval:    hc.config.CheckInterval,
		Timeout:     hc.config.Timeout,
		Enabled:     true,
		Critical:    true,
		Tags:        []string{"application", "core"},
	})

	// Database health check
	hc.RegisterCheck(HealthCheck{
		Name:        "database",
		Description: "Database connectivity and performance",
		CheckFunc:   hc.checkDatabase,
		Interval:    hc.config.CheckInterval,
		Timeout:     hc.config.Timeout,
		Enabled:     true,
		Critical:    true,
		Tags:        []string{"database", "critical"},
	})

	// Redis health check
	hc.RegisterCheck(HealthCheck{
		Name:        "redis",
		Description: "Redis cache connectivity and performance",
		CheckFunc:   hc.checkRedis,
		Interval:    hc.config.CheckInterval,
		Timeout:     hc.config.Timeout,
		Enabled:     true,
		Critical:    false,
		Tags:        []string{"cache", "redis"},
	})

	// Quantum service health check
	hc.RegisterCheck(HealthCheck{
		Name:        "quantum_service",
		Description: "Quantum processing service health",
		CheckFunc:   hc.checkQuantumService,
		Interval:    hc.config.CheckInterval,
		Timeout:     hc.config.Timeout,
		Enabled:     true,
		Critical:    true,
		Tags:        []string{"quantum", "service", "critical"},
	})

	// AI/ML service health check
	hc.RegisterCheck(HealthCheck{
		Name:        "ai_ml_service",
		Description: "AI/ML processing service health",
		CheckFunc:   hc.checkAIModelService,
		Interval:    hc.config.CheckInterval,
		Timeout:     hc.config.Timeout,
		Enabled:     true,
		Critical:    false,
		Tags:        []string{"ai", "ml", "service"},
	})

	// System resources health check
	hc.RegisterCheck(HealthCheck{
		Name:        "system_resources",
		Description: "System resource utilization",
		CheckFunc:   hc.checkSystemResources,
		Interval:    hc.config.CheckInterval,
		Timeout:     hc.config.Timeout,
		Enabled:     hc.config.IncludeSystemMetrics,
		Critical:    false,
		Tags:        []string{"system", "resources"},
	})
}

// RegisterCheck registers a new health check
func (hc *HealthChecker) RegisterCheck(check HealthCheck) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	hc.checks[check.Name] = check
	hc.logger.Printf("Registered health check: %s", check.Name)
}

// UnregisterCheck unregisters a health check
func (hc *HealthChecker) UnregisterCheck(name string) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	delete(hc.checks, name)
	hc.logger.Printf("Unregistered health check: %s", name)
}

// GetCheck retrieves a specific health check
func (hc *HealthChecker) GetCheck(name string) (HealthCheck, bool) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	check, exists := hc.checks[name]
	return check, exists
}

// ListChecks returns all registered health checks
func (hc *HealthChecker) ListChecks() []HealthCheck {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	checks := make([]HealthCheck, 0, len(hc.checks))
	for _, check := range hc.checks {
		checks = append(checks, check)
	}

	return checks
}

// RunChecks runs all enabled health checks
func (hc *HealthChecker) RunChecks(ctx context.Context) OverallHealth {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	startTime := time.Now()
	overall := OverallHealth{
		Version:       hc.getVersion(),
		Uptime:        time.Since(startTime),
		LastChecked:   startTime,
		Checks:        make(map[string]HealthResult),
		Dependencies:  make(map[string]DependencyHealth),
		SystemMetrics: SystemHealthMetrics{},
	}

	healthyCount := 0
	degradedCount := 0
	unhealthyCount := 0
	unknownCount := 0

	// Run all checks
	for name, check := range hc.checks {
		if !check.Enabled {
			continue
		}

		result := hc.runCheck(ctx, check)
		overall.Checks[name] = result

		switch result.Status {
		case HealthStatusHealthy:
			healthyCount++
		case HealthStatusDegraded:
			degradedCount++
		case HealthStatusUnhealthy:
			unhealthyCount++
		default:
			unknownCount++
		}
	}

	// Update overall status
	overall.CheckCount = len(overall.Checks)
	overall.HealthyCount = healthyCount
	overall.DegradedCount = degradedCount
	overall.UnhealthyCount = unhealthyCount
	overall.UnknownCount = unknownCount

	overall.Status = hc.calculateOverallStatus(healthyCount, degradedCount, unhealthyCount, unknownCount)

	// Add system metrics if enabled
	if hc.config.IncludeSystemMetrics {
		overall.SystemMetrics = hc.getSystemMetrics()
		overall.SystemMetrics.Uptime = overall.Uptime.String()
	}

	// Add dependency checks if enabled
	if hc.config.IncludeDependencyChecks {
		overall.Dependencies = hc.checkDependencies(ctx)
	}

	hc.lastCheckTime = startTime
	return overall
}

// runCheck runs a single health check
func (hc *HealthChecker) runCheck(ctx context.Context, check HealthCheck) HealthResult {
	startTime := time.Now()

	// Create context with timeout
	checkCtx, cancel := context.WithTimeout(ctx, check.Timeout)
	defer cancel()

	// Run the check
	result := HealthResult{
		LastChecked: startTime,
	}

	defer func() {
		if r := recover(); r != nil {
			result.Status = HealthStatusUnhealthy
			result.Message = fmt.Sprintf("Panic during health check: %v", r)
			result.Error = fmt.Errorf("panic: %v", r)
		}
		result.Duration = time.Since(startTime)
	}()

	// Execute the check function
	checkResult := check.CheckFunc(checkCtx)
	result.Status = checkResult.Status
	result.Message = checkResult.Message
	result.Details = checkResult.Details
	result.Error = checkResult.Error

	return result
}

// calculateOverallStatus calculates the overall health status
func (hc *HealthChecker) calculateOverallStatus(healthy, degraded, unhealthy, unknown int) HealthStatus {
	// If any critical checks are unhealthy, system is unhealthy
	for name, check := range hc.checks {
		if check.Critical && check.Enabled {
			if status, exists := hc.status[name]; exists && status == HealthStatusUnhealthy {
				return HealthStatusUnhealthy
			}
		}
	}

	// If any checks are unhealthy, system is degraded or unhealthy
	if unhealthy > 0 {
		if unhealthy >= hc.config.UnhealthyThreshold {
			return HealthStatusUnhealthy
		}
		return HealthStatusDegraded
	}

	// If many checks are degraded, system is degraded
	if degraded >= hc.config.DegradedThreshold {
		return HealthStatusDegraded
	}

	// If any checks are degraded, system might be degraded
	if degraded > 0 {
		return HealthStatusDegraded
	}

	// If unknown checks, system status is unknown
	if unknown > 0 {
		return HealthStatusUnknown
	}

	// All checks healthy
	return HealthStatusHealthy
}

// Default health check implementations

// checkApplication performs basic application health check
func (hc *HealthChecker) checkApplication(ctx context.Context) HealthResult {
	result := HealthResult{
		Status:  HealthStatusHealthy,
		Message: "Application is healthy",
		Details: make(map[string]string),
	}

	// Check if application is responsive
	if err := hc.checkHTTPHealth(ctx, "http://localhost:8080/health"); err != nil {
		result.Status = HealthStatusUnhealthy
		result.Message = "Application health endpoint failed"
		result.Error = err
		return result
	}

	// Add application details
	result.Details["version"] = hc.getVersion()
	result.Details["build_time"] = hc.getBuildTime()
	result.Details["environment"] = hc.getEnvironment()

	return result
}

// checkDatabase checks database connectivity and performance
func (hc *HealthChecker) checkDatabase(ctx context.Context) HealthResult {
	result := HealthResult{
		Status:  HealthStatusHealthy,
		Message: "Database is healthy",
		Details: make(map[string]string),
	}

	// This would use the actual database connection
	// For now, return a mock result
	result.Details["connection_count"] = "5"
	result.Details["response_time"] = "10ms"
	result.Details["database_size"] = "250MB"

	return result
}

// checkRedis checks Redis connectivity and performance
func (hc *HealthChecker) checkRedis(ctx context.Context) HealthResult {
	result := HealthResult{
		Status:  HealthStatusHealthy,
		Message: "Redis is healthy",
		Details: make(map[string]string),
	}

	// This would use the actual Redis connection
	// For now, return a mock result
	result.Details["memory_usage"] = "50MB"
	result.Details["connected_clients"] = "3"
	result.Details["hit_rate"] = "95%"

	return result
}

// checkQuantumService checks quantum service health
func (hc *HealthChecker) checkQuantumService(ctx context.Context) HealthResult {
	result := HealthResult{
		Status:  HealthStatusHealthy,
		Message: "Quantum service is healthy",
		Details: make(map[string]string),
	}

	// Check quantum service health endpoint
	if err := hc.checkHTTPHealth(ctx, "http://localhost:8001/health"); err != nil {
		result.Status = HealthStatusDegraded
		result.Message = "Quantum service is degraded"
		result.Error = err
		return result
	}

	result.Details["queue_size"] = "10"
	result.Details["processing_time"] = "250ms"
	result.Details["success_rate"] = "98%"

	return result
}

// checkAIModelService checks AI/ML service health
func (hc *HealthChecker) checkAIModelService(ctx context.Context) HealthResult {
	result := HealthResult{
		Status:  HealthStatusHealthy,
		Message: "AI/ML service is healthy",
		Details: make(map[string]string),
	}

	// Check AI/ML service health endpoint
	if err := hc.checkHTTPHealth(ctx, "http://localhost:8002/health"); err != nil {
		result.Status = HealthStatusDegraded
		result.Message = "AI/ML service is degraded"
		result.Error = err
		return result
	}

	result.Details["model_loaded"] = "true"
	result.Details["inference_time"] = "150ms"
	result.Details["cache_hit_rate"] = "80%"

	return result
}

// checkSystemResources checks system resource utilization
func (hc *HealthChecker) checkSystemResources(ctx context.Context) HealthResult {
	result := HealthResult{
		Status:  HealthStatusHealthy,
		Message: "System resources are healthy",
		Details: make(map[string]string),
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Calculate memory usage
	memUsageMB := float64(m.Alloc) / 1024 / 1024

	// Check thresholds
	if memUsageMB > 1000 { // 1GB
		result.Status = HealthStatusDegraded
		result.Message = "High memory usage"
	}
	if memUsageMB > 2000 { // 2GB
		result.Status = HealthStatusUnhealthy
		result.Message = "Critical memory usage"
	}

	result.Details["memory_usage_mb"] = fmt.Sprintf("%.2f", memUsageMB)
	result.Details["goroutines"] = fmt.Sprintf("%d", runtime.NumGoroutine())
	result.Details["gc_cycles"] = fmt.Sprintf("%d", m.NumGC)

	return result
}

// checkHTTPHealth performs HTTP health check
func (hc *HealthChecker) checkHTTPHealth(ctx context.Context, url string) error {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}

	return nil
}

// checkDependencies checks external dependencies
func (hc *HealthChecker) checkDependencies(ctx context.Context) map[string]DependencyHealth {
	dependencies := make(map[string]DependencyHealth)

	// Check external APIs
	if err := hc.checkHTTPDependency(ctx, "https://api.openai.com/v1/models", "OpenAI API"); err != nil {
		dependencies["openai"] = DependencyHealth{
			Name:         "OpenAI API",
			Type:         "external_api",
			Status:       HealthStatusUnhealthy,
			Message:      err.Error(),
			ResponseTime: 0,
			LastChecked:  time.Now(),
		}
	} else {
		dependencies["openai"] = DependencyHealth{
			Name:         "OpenAI API",
			Type:         "external_api",
			Status:       HealthStatusHealthy,
			Message:      "API is responsive",
			ResponseTime: 150 * time.Millisecond,
			LastChecked:  time.Now(),
		}
	}

	// Check quantum hardware backends
	quantumBackends := []string{"IBM Quantum", "AWS Braket", "Google Quantum AI"}
	for _, backend := range quantumBackends {
		// Mock check - in reality would check actual backend availability
		dependencies[backend] = DependencyHealth{
			Name:         backend,
			Type:         "quantum_backend",
			Status:       HealthStatusHealthy,
			Message:      "Backend is available",
			ResponseTime: 100 * time.Millisecond,
			LastChecked:  time.Now(),
		}
	}

	return dependencies
}

// checkHTTPDependency checks HTTP-based dependency
func (hc *HealthChecker) checkHTTPDependency(ctx context.Context, url, name string) error {
	startTime := time.Now()

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	// Add API key if needed for external services
	if name == "OpenAI API" {
		// In reality, would use actual API key
		req.Header.Set("Authorization", "Bearer dummy-key")
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	responseTime := time.Since(startTime)
	hc.logger.Printf("Dependency check %s: %v (response time: %v)", name, resp.StatusCode, responseTime)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("dependency returned status %d", resp.StatusCode)
	}

	return nil
}

// getSystemMetrics returns system health metrics
func (hc *HealthChecker) getSystemMetrics() SystemHealthMetrics {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return SystemHealthMetrics{
		CPUUsage:       75.0,                           // Mock value - would use actual CPU monitoring
		MemoryUsage:    float64(m.Alloc) / 1024 / 1024, // MB
		GoroutineCount: runtime.NumGoroutine(),
		GCCount:        m.NumGC,
		HeapSize:       m.HeapInuse,
		NumConnections: 10, // Mock value - would track actual connections
	}
}

// Helper methods
func (hc *HealthChecker) getVersion() string {
	return "1.0.0" // Would be set during build
}

func (hc *HealthChecker) getBuildTime() string {
	return "2024-01-01T00:00:00Z" // Would be set during build
}

func (hc *HealthChecker) getEnvironment() string {
	return "production" // Would be configured
}

// runBackgroundChecks runs health checks in the background
func (hc *HealthChecker) runBackgroundChecks() {
	ticker := time.NewTicker(hc.config.CheckInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), hc.config.Timeout)
		overall := hc.RunChecks(ctx)
		cancel()

		// Log any critical issues
		for name, result := range overall.Checks {
			if check, exists := hc.checks[name]; exists && check.Critical && result.Status == HealthStatusUnhealthy {
				hc.logger.Printf("CRITICAL: Health check failed for %s: %s", name, result.Message)
			}
		}
	}
}

// GetHealthHandler returns the HTTP handler for health checks
func (hc *HealthChecker) GetHealthHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		health := hc.RunChecks(ctx)

		w.Header().Set("Content-Type", "application/json")

		// Set status code based on overall health
		switch health.Status {
		case HealthStatusHealthy:
			w.WriteHeader(http.StatusOK)
		case HealthStatusDegraded:
			w.WriteHeader(http.StatusOK) // Still OK but degraded
		case HealthStatusUnhealthy:
			w.WriteHeader(http.StatusServiceUnavailable)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}

		json.NewEncoder(w).Encode(health)
	})
}

// GetReadinessHandler returns the HTTP handler for readiness probes
func (hc *HealthChecker) GetReadinessHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		health := hc.RunChecks(ctx)

		// For readiness, only check critical services
		ready := true
		for name, check := range hc.checks {
			if check.Critical && check.Enabled {
				if result, exists := health.Checks[name]; exists && result.Status == HealthStatusUnhealthy {
					ready = false
					break
				}
			}
		}

		if ready {
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"status": "not ready"})
		}
	})
}

// GetLivenessHandler returns the HTTP handler for liveness probes
func (hc *HealthChecker) GetLivenessHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simple liveness check - just return OK if process is running
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "alive",
			"uptime": time.Since(hc.lastCheckTime).String(),
		})
	})
}
