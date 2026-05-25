package health

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"time"
)

// Status represents the health status
type Status string

const (
	StatusHealthy   Status = "healthy"
	StatusUnhealthy Status = "unhealthy"
	StatusDegraded  Status = "degraded"
)

// Check represents a health check function
type Check func(ctx context.Context) CheckResult

// CheckResult represents the result of a health check
type CheckResult struct {
	Status   Status            `json:"status"`
	Message  string            `json:"message,omitempty"`
	Details  map[string]string `json:"details,omitempty"`
	Duration time.Duration     `json:"duration"`
}

// HealthCheck represents a registered health check
type HealthCheck struct {
	name        string
	check       Check
	timeout     time.Duration
	enabled     bool
	lastResult  *CheckResult
	lastChecked time.Time
}

// Health manages health checks
type Health struct {
	mu     sync.RWMutex
	checks map[string]*HealthCheck
	config *Config
}

// Config holds health check configuration
type Config struct {
	Enabled         bool          `json:"enabled"`
	Timeout         time.Duration `json:"timeout"`
	CheckInterval   time.Duration `json:"check_interval"`
	MaxFailedChecks int           `json:"max_failed_checks"`
	CacheDuration   time.Duration `json:"cache_duration"`
	IncludeDetails  bool          `json:"include_details"`
}

// DefaultConfig returns default health check configuration
func DefaultConfig() *Config {
	return &Config{
		Enabled:         true,
		Timeout:         30 * time.Second,
		CheckInterval:   5 * time.Minute,
		MaxFailedChecks: 3,
		CacheDuration:   30 * time.Second,
		IncludeDetails:  true,
	}
}

// New creates a new health manager
func New(cfg *Config) *Health {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	return &Health{
		checks: make(map[string]*HealthCheck),
		config: cfg,
	}
}

// RegisterCheck registers a new health check
func (h *Health) RegisterCheck(name string, check Check, opts ...CheckOption) {
	h.mu.Lock()
	defer h.mu.Unlock()

	hc := &HealthCheck{
		name:    name,
		check:   check,
		timeout: h.config.Timeout,
		enabled: true,
	}

	// Apply options
	for _, opt := range opts {
		opt(hc)
	}

	h.checks[name] = hc
}

// UnregisterCheck unregisters a health check
func (h *Health) UnregisterCheck(name string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.checks, name)
}

// EnableCheck enables a health check
func (h *Health) EnableCheck(name string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if hc, exists := h.checks[name]; exists {
		hc.enabled = true
	}
}

// DisableCheck disables a health check
func (h *Health) DisableCheck(name string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if hc, exists := h.checks[name]; exists {
		hc.enabled = false
	}
}

// CheckHealth runs all enabled health checks
func (h *Health) CheckHealth(ctx context.Context) OverallStatus {
	h.mu.RLock()
	defer h.mu.RUnlock()

	results := make(map[string]CheckResult)
	overallStatus := StatusHealthy

	for name, hc := range h.checks {
		if !hc.enabled {
			continue
		}

		// Check if we can use cached result
		if h.config.CacheDuration > 0 &&
			!hc.lastChecked.IsZero() &&
			time.Since(hc.lastChecked) < h.config.CacheDuration {
			results[name] = *hc.lastResult
			if hc.lastResult.Status == StatusUnhealthy {
				overallStatus = StatusUnhealthy
			} else if hc.lastResult.Status == StatusDegraded && overallStatus == StatusHealthy {
				overallStatus = StatusDegraded
			}
			continue
		}

		// Run health check
		result := h.runCheck(ctx, hc)
		hc.lastResult = &result
		hc.lastChecked = time.Now()
		results[name] = result

		if result.Status == StatusUnhealthy {
			overallStatus = StatusUnhealthy
		} else if result.Status == StatusDegraded && overallStatus == StatusHealthy {
			overallStatus = StatusDegraded
		}
	}

	return OverallStatus{
		Status:    overallStatus,
		Checks:    results,
		Timestamp: time.Now(),
	}
}

// runCheck runs a single health check
func (h *Health) runCheck(ctx context.Context, hc *HealthCheck) CheckResult {
	start := time.Now()

	// Create context with timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, hc.timeout)
	defer cancel()

	// Run check in goroutine to respect timeout
	resultChan := make(chan CheckResult, 1)
	go func() {
		resultChan <- hc.check(timeoutCtx)
	}()

	select {
	case result := <-resultChan:
		result.Duration = time.Since(start)
		return result
	case <-timeoutCtx.Done():
		return CheckResult{
			Status:   StatusUnhealthy,
			Message:  "Health check timed out",
			Duration: time.Since(start),
		}
	}
}

// CheckHealthByName runs a specific health check by name
func (h *Health) CheckHealthByName(ctx context.Context, name string) (CheckResult, error) {
	h.mu.RLock()
	hc, exists := h.checks[name]
	h.mu.RUnlock()

	if !exists {
		return CheckResult{}, fmt.Errorf("health check '%s' not found", name)
	}

	if !hc.enabled {
		return CheckResult{
			Status:  StatusUnhealthy,
			Message: "Health check is disabled",
		}, nil
	}

	return h.runCheck(ctx, hc), nil
}

// GetEnabledChecks returns a list of enabled health check names
func (h *Health) GetEnabledChecks() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var names []string
	for name, hc := range h.checks {
		if hc.enabled {
			names = append(names, name)
		}
	}
	return names
}

// OverallStatus represents the overall health status
type OverallStatus struct {
	Status    Status                 `json:"status"`
	Checks    map[string]CheckResult `json:"checks,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// CheckOption is a function that configures a health check
type CheckOption func(*HealthCheck)

// WithTimeout sets the timeout for a health check
func WithTimeout(timeout time.Duration) CheckOption {
	return func(hc *HealthCheck) {
		hc.timeout = timeout
	}
}

// WithEnabled sets whether a health check is enabled
func WithEnabled(enabled bool) CheckOption {
	return func(hc *HealthCheck) {
		hc.enabled = enabled
	}
}

// Common health check functions

// DatabaseHealthCheck creates a database health check
func DatabaseHealthCheck(db DatabaseChecker) Check {
	return func(ctx context.Context) CheckResult {
		if err := db.Ping(ctx); err != nil {
			return CheckResult{
				Status:  StatusUnhealthy,
				Message: "Database connection failed",
				Details: map[string]string{"error": err.Error()},
			}
		}

		return CheckResult{
			Status:  StatusHealthy,
			Message: "Database connection successful",
		}
	}
}

// RedisHealthCheck creates a Redis health check
func RedisHealthCheck(redis RedisChecker) Check {
	return func(ctx context.Context) CheckResult {
		if err := redis.Ping(ctx); err != nil {
			return CheckResult{
				Status:  StatusUnhealthy,
				Message: "Redis connection failed",
				Details: map[string]string{"error": err.Error()},
			}
		}

		return CheckResult{
			Status:  StatusHealthy,
			Message: "Redis connection successful",
		}
	}
}

// HTTPHealthCheck creates an HTTP endpoint health check
func HTTPHealthCheck(url string, client *http.Client) Check {
	return func(ctx context.Context) CheckResult {
		if client == nil {
			client = &http.Client{Timeout: 10 * time.Second}
		}

		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return CheckResult{
				Status:  StatusUnhealthy,
				Message: "Failed to create request",
				Details: map[string]string{"error": err.Error()},
			}
		}

		resp, err := client.Do(req)
		if err != nil {
			return CheckResult{
				Status:  StatusUnhealthy,
				Message: "HTTP request failed",
				Details: map[string]string{"error": err.Error()},
			}
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			return CheckResult{
				Status:  StatusUnhealthy,
				Message: "HTTP endpoint returned error",
				Details: map[string]string{"status_code": fmt.Sprintf("%d", resp.StatusCode)},
			}
		}

		return CheckResult{
			Status:  StatusHealthy,
			Message: "HTTP endpoint is healthy",
			Details: map[string]string{"status_code": fmt.Sprintf("%d", resp.StatusCode)},
		}
	}
}

// MemoryHealthCheck creates a memory usage health check
func MemoryHealthCheck(thresholdBytes int64) Check {
	return func(ctx context.Context) CheckResult {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		if m.Alloc > uint64(thresholdBytes) {
			return CheckResult{
				Status:  StatusDegraded,
				Message: "High memory usage",
				Details: map[string]string{
					"allocated": fmt.Sprintf("%d bytes", m.Alloc),
					"threshold": fmt.Sprintf("%d bytes", thresholdBytes),
				},
			}
		}

		return CheckResult{
			Status:  StatusHealthy,
			Message: "Memory usage is normal",
			Details: map[string]string{"allocated": fmt.Sprintf("%d bytes", m.Alloc)},
		}
	}
}

// DatabaseChecker interface for database health checks
type DatabaseChecker interface {
	Ping(ctx context.Context) error
}

// RedisChecker interface for Redis health checks
type RedisChecker interface {
	Ping(ctx context.Context) error
}

// HTTPHandler returns an HTTP handler for health checks
func (h *Health) HTTPHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !h.config.Enabled {
			http.Error(w, "Health checks disabled", http.StatusServiceUnavailable)
			return
		}

		ctx := r.Context()
		checkName := r.URL.Query().Get("check")

		w.Header().Set("Content-Type", "application/json")

		if checkName != "" {
			// Run specific check
			result, err := h.CheckHealthByName(ctx, checkName)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}

			json.NewEncoder(w).Encode(result)
			return
		}

		// Run all checks
		status := h.CheckHealth(ctx)

		// Set HTTP status based on overall status
		switch status.Status {
		case StatusHealthy:
			w.WriteHeader(http.StatusOK)
		case StatusDegraded:
			w.WriteHeader(http.StatusOK) // Still OK but degraded
		case StatusUnhealthy:
			w.WriteHeader(http.StatusServiceUnavailable)
		}

		// Include details only if configured
		if !h.config.IncludeDetails {
			status.Checks = nil
		}

		json.NewEncoder(w).Encode(status)
	})
}

// Global health manager
var globalHealth *Health

// InitGlobal initializes the global health manager
func InitGlobal(cfg *Config) {
	globalHealth = New(cfg)
}

// GetGlobal returns the global health manager
func GetGlobal() *Health {
	if globalHealth == nil {
		InitGlobal(nil)
	}
	return globalHealth
}
