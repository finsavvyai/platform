package health

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// HealthChecker interface for health check implementations
type HealthChecker interface {
	Name() string
	Check(ctx context.Context) HealthCheckResult
}

// HealthCheckResult represents the result of a health check
type HealthCheckResult struct {
	Status      string                 `json:"status"` // "healthy", "unhealthy", "degraded"
	Message     string                 `json:"message,omitempty"`
	Details     map[string]interface{} `json:"details,omitempty"`
	Duration    time.Duration          `json:"duration"`
	Timestamp   time.Time              `json:"timestamp"`
	LastChecked time.Time              `json:"last_checked"`
}

// HealthStatus represents overall health status
type HealthStatus struct {
	Status    string                       `json:"status"`
	Timestamp time.Time                    `json:"timestamp"`
	Version   string                       `json:"version"`
	Uptime    time.Duration                `json:"uptime"`
	Checks    map[string]HealthCheckResult `json:"checks"`
	System    SystemInfo                   `json:"system"`
	Metadata  map[string]interface{}       `json:"metadata,omitempty"`
}

// SystemInfo contains system information
type SystemInfo struct {
	GoVersion     string    `json:"go_version"`
	OS            string    `json:"os"`
	Architecture  string    `json:"architecture"`
	NumCPU        int       `json:"num_cpu"`
	NumGoroutines int       `json:"num_goroutines"`
	MemoryUsage   MemInfo   `json:"memory_usage"`
	StartTime     time.Time `json:"start_time"`
	CurrentTime   time.Time `json:"current_time"`
}

// MemInfo contains memory information
type MemInfo struct {
	Alloc        uint64 `json:"alloc"`
	TotalAlloc   uint64 `json:"total_alloc"`
	Sys          uint64 `json:"sys"`
	Lookups      uint64 `json:"lookups"`
	Mallocs      uint64 `json:"mallocs"`
	Frees        uint64 `json:"frees"`
	HeapAlloc    uint64 `json:"heap_alloc"`
	HeapSys      uint64 `json:"heap_sys"`
	HeapIdle     uint64 `json:"heap_idle"`
	HeapInuse    uint64 `json:"heap_inuse"`
	HeapReleased uint64 `json:"heap_released"`
	HeapObjects  uint64 `json:"heap_objects"`
	StackInuse   uint64 `json:"stack_inuse"`
	StackSys     uint64 `json:"stack_sys"`
	GCSys        uint64 `json:"gc_sys"`
	NumGC        uint32 `json:"num_gc"`
}

// HealthManager manages health checks
type HealthManager struct {
	checkers      map[string]HealthChecker
	results       map[string]HealthCheckResult
	config        HealthConfig
	startTime     time.Time
	mu            sync.RWMutex
	cachedStatus  *HealthStatus
	cacheExpiry   time.Time
	cacheDuration time.Duration
}

// HealthConfig contains configuration for health checks
type HealthConfig struct {
	Enabled         bool          `json:"enabled"`
	CheckInterval   time.Duration `json:"check_interval"`
	Timeout         time.Duration `json:"timeout"`
	CacheDuration   time.Duration `json:"cache_duration"`
	Version         string        `json:"version"`
	IncludeSystem   bool          `json:"include_system"`
	IncludeDetails  bool          `json:"include_details"`
	FailFast        bool          `json:"fail_fast"`
	LivenessChecks  []string      `json:"liveness_checks"`
	ReadinessChecks []string      `json:"readiness_checks"`
}

// DatabaseHealthChecker checks database connectivity
type DatabaseHealthChecker struct {
	db     *gorm.DB
	name   string
	config DatabaseHealthConfig
}

// DatabaseHealthConfig contains database health check configuration
type DatabaseHealthConfig struct {
	MaxIdleConnections int           `json:"max_idle_connections"`
	MaxOpenConnections int           `json:"max_open_connections"`
	QueryTimeout       time.Duration `json:"query_timeout"`
	RequiredTables     []string      `json:"required_tables"`
}

// RedisHealthChecker checks Redis connectivity
type RedisHealthChecker struct {
	client RedisClient
	name   string
	config RedisHealthConfig
}

// RedisClient interface for Redis client
type RedisClient interface {
	Ping(ctx context.Context) error
	Info(ctx context.Context) (string, error)
}

// RedisHealthConfig contains Redis health check configuration
type RedisHealthConfig struct {
	MaxRetries    int           `json:"max_retries"`
	RetryDelay    time.Duration `json:"retry_delay"`
	KeyExpiryTest time.Duration `json:"key_expiry_test"`
}

// HTTPHealthChecker checks external HTTP service health
type HTTPHealthChecker struct {
	url    string
	name   string
	config HTTPHealthConfig
	client *http.Client
}

// HTTPHealthConfig contains HTTP health check configuration
type HTTPHealthConfig struct {
	ExpectedStatus int               `json:"expected_status"`
	Timeout        time.Duration     `json:"timeout"`
	Headers        map[string]string `json:"headers"`
	Method         string            `json:"method"`
	Body           string            `json:"body"`
}

// CustomHealthChecker allows custom health check implementations
type CustomHealthChecker struct {
	name      string
	checkFunc func(ctx context.Context) HealthCheckResult
}

// NewHealthManager creates a new health manager
func NewHealthManager(config HealthConfig) *HealthManager {
	if config.CacheDuration == 0 {
		config.CacheDuration = 30 * time.Second
	}
	if config.Timeout == 0 {
		config.Timeout = 10 * time.Second
	}
	if config.CheckInterval == 0 {
		config.CheckInterval = 30 * time.Second
	}

	return &HealthManager{
		checkers:      make(map[string]HealthChecker),
		results:       make(map[string]HealthCheckResult),
		config:        config,
		startTime:     time.Now(),
		cacheDuration: config.CacheDuration,
	}
}

// AddChecker adds a health checker
func (hm *HealthManager) AddChecker(checker HealthChecker) {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	hm.checkers[checker.Name()] = checker
}

// RemoveChecker removes a health checker
func (hm *HealthManager) RemoveChecker(name string) {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	delete(hm.checkers, name)
	delete(hm.results, name)
}

// RunChecks executes all health checks
func (hm *HealthManager) RunChecks(ctx context.Context) HealthStatus {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	// Check if cached result is still valid
	if hm.cachedStatus != nil && time.Now().Before(hm.cacheExpiry) {
		return *hm.cachedStatus
	}

	results := make(map[string]HealthCheckResult)
	overallStatus := "healthy"

	// Run all checks
	for name, checker := range hm.checkers {
		checkCtx, cancel := context.WithTimeout(ctx, hm.config.Timeout)
		result := checker.Check(checkCtx)
		cancel()

		results[name] = result

		// Update overall status
		if result.Status == "unhealthy" {
			overallStatus = "unhealthy"
			if hm.config.FailFast {
				break
			}
		} else if result.Status == "degraded" && overallStatus == "healthy" {
			overallStatus = "degraded"
		}

		hm.results[name] = result
	}

	// Create health status
	status := HealthStatus{
		Status:    overallStatus,
		Timestamp: time.Now(),
		Version:   hm.config.Version,
		Uptime:    time.Since(hm.startTime),
		Checks:    results,
	}

	// Add system information if enabled
	if hm.config.IncludeSystem {
		status.System = hm.getSystemInfo()
	}

	// Cache the result
	hm.cachedStatus = &status
	hm.cacheExpiry = time.Now().Add(hm.cacheDuration)

	return status
}

// RunLivenessChecks runs only liveness checks
func (hm *HealthManager) RunLivenessChecks(ctx context.Context) HealthStatus {
	return hm.runSelectedChecks(ctx, hm.config.LivenessChecks)
}

// RunReadinessChecks runs only readiness checks
func (hm *HealthManager) RunReadinessChecks(ctx context.Context) HealthStatus {
	return hm.runSelectedChecks(ctx, hm.config.ReadinessChecks)
}

// runSelectedChecks runs specific health checks
func (hm *HealthManager) runSelectedChecks(ctx context.Context, checkNames []string) HealthStatus {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	results := make(map[string]HealthCheckResult)
	overallStatus := "healthy"

	for _, name := range checkNames {
		if checker, exists := hm.checkers[name]; exists {
			checkCtx, cancel := context.WithTimeout(ctx, hm.config.Timeout)
			result := checker.Check(checkCtx)
			cancel()

			results[name] = result

			if result.Status == "unhealthy" {
				overallStatus = "unhealthy"
				if hm.config.FailFast {
					break
				}
			} else if result.Status == "degraded" && overallStatus == "healthy" {
				overallStatus = "degraded"
			}
		}
	}

	return HealthStatus{
		Status:    overallStatus,
		Timestamp: time.Now(),
		Version:   hm.config.Version,
		Uptime:    time.Since(hm.startTime),
		Checks:    results,
	}
}

// getSystemInfo collects system information
func (hm *HealthManager) getSystemInfo() SystemInfo {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return SystemInfo{
		GoVersion:     runtime.Version(),
		OS:            runtime.GOOS,
		Architecture:  runtime.GOARCH,
		NumCPU:        runtime.NumCPU(),
		NumGoroutines: runtime.NumGoroutine(),
		MemoryUsage: MemInfo{
			Alloc:        m.Alloc,
			TotalAlloc:   m.TotalAlloc,
			Sys:          m.Sys,
			Lookups:      m.Lookups,
			Mallocs:      m.Mallocs,
			Frees:        m.Frees,
			HeapAlloc:    m.HeapAlloc,
			HeapSys:      m.HeapSys,
			HeapIdle:     m.HeapIdle,
			HeapInuse:    m.HeapInuse,
			HeapReleased: m.HeapReleased,
			HeapObjects:  m.HeapObjects,
			StackInuse:   m.StackInuse,
			StackSys:     m.StackSys,
			GCSys:        m.GCSys,
			NumGC:        m.NumGC,
		},
		StartTime:   hm.startTime,
		CurrentTime: time.Now(),
	}
}

// StartBackgroundChecks starts background health checks
func (hm *HealthManager) StartBackgroundChecks(ctx context.Context) {
	if !hm.config.Enabled {
		return
	}

	ticker := time.NewTicker(hm.config.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			hm.RunChecks(ctx)
		}
	}
}

// GetLatestResults returns the latest health check results
func (hm *HealthManager) GetLatestResults() map[string]HealthCheckResult {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	results := make(map[string]HealthCheckResult)
	for k, v := range hm.results {
		results[k] = v
	}
	return results
}

// ClearCache clears the health status cache
func (hm *HealthManager) ClearCache() {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	hm.cachedStatus = nil
	hm.cacheExpiry = time.Time{}
}

// DatabaseHealthChecker implementation
func NewDatabaseHealthChecker(name string, db *gorm.DB, config DatabaseHealthConfig) *DatabaseHealthChecker {
	return &DatabaseHealthChecker{
		db:     db,
		name:   name,
		config: config,
	}
}

func (dhc *DatabaseHealthChecker) Name() string {
	return dhc.name
}

func (dhc *DatabaseHealthChecker) Check(ctx context.Context) HealthCheckResult {
	start := time.Now()
	result := HealthCheckResult{
		Timestamp: start,
	}

	sqlDB, err := dhc.db.DB()
	if err != nil {
		result.Status = "unhealthy"
		result.Message = "Failed to get database instance"
		result.Duration = time.Since(start)
		return result
	}

	// Check database connection
	err = sqlDB.PingContext(ctx)
	if err != nil {
		result.Status = "unhealthy"
		result.Message = fmt.Sprintf("Database ping failed: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	// Get database stats
	stats := sqlDB.Stats()
	details := map[string]interface{}{
		"open_connections":     stats.OpenConnections,
		"in_use":               stats.InUse,
		"idle":                 stats.Idle,
		"wait_count":           stats.WaitCount,
		"wait_duration":        stats.WaitDuration.String(),
		"max_idle_closed":      stats.MaxIdleClosed,
		"max_idle_time_closed": stats.MaxIdleTimeClosed,
		"max_lifetime_closed":  stats.MaxLifetimeClosed,
	}

	// Check connection limits
	if dhc.config.MaxOpenConnections > 0 && stats.OpenConnections >= dhc.config.MaxOpenConnections {
		result.Status = "degraded"
		result.Message = "Approaching connection limit"
	} else if dhc.config.MaxIdleConnections > 0 && stats.Idle > dhc.config.MaxIdleConnections {
		result.Status = "degraded"
		result.Message = "Too many idle connections"
	} else {
		result.Status = "healthy"
		result.Message = "Database connection healthy"
	}

	// Test database query
	var count int64
	queryStart := time.Now()
	err = dhc.db.WithContext(ctx).Raw("SELECT 1").Scan(&count).Error
	queryDuration := time.Since(queryStart)

	if err != nil {
		result.Status = "unhealthy"
		result.Message = fmt.Sprintf("Database query failed: %v", err)
	} else if queryDuration > dhc.config.QueryTimeout {
		result.Status = "degraded"
		result.Message = "Database query slow"
		details["query_duration"] = queryDuration.String()
	} else {
		details["query_duration"] = queryDuration.String()
		details["test_query_result"] = count
	}

	result.Details = details
	result.Duration = time.Since(start)
	result.LastChecked = time.Now()

	return result
}

// RedisHealthChecker implementation
func NewRedisHealthChecker(name string, client RedisClient, config RedisHealthConfig) *RedisHealthChecker {
	return &RedisHealthChecker{
		client: client,
		name:   name,
		config: config,
	}
}

func (rhc *RedisHealthChecker) Name() string {
	return rhc.name
}

func (rhc *RedisHealthChecker) Check(ctx context.Context) HealthCheckResult {
	start := time.Now()
	result := HealthCheckResult{
		Timestamp: start,
	}

	// Test Redis ping
	err := rhc.client.Ping(ctx)
	if err != nil {
		result.Status = "unhealthy"
		result.Message = fmt.Sprintf("Redis ping failed: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	// Get Redis info
	info, err := rhc.client.Info(ctx)
	if err != nil {
		result.Status = "degraded"
		result.Message = fmt.Sprintf("Redis info failed: %v", err)
	} else {
		result.Status = "healthy"
		result.Message = "Redis connection healthy"
	}

	details := map[string]interface{}{
		"ping_success": true,
	}

	if info != "" {
		details["server_info"] = info
	}

	result.Details = details
	result.Duration = time.Since(start)
	result.LastChecked = time.Now()

	return result
}

// HTTPHealthChecker implementation
func NewHTTPHealthChecker(name, url string, config HTTPHealthConfig) *HTTPHealthChecker {
	if config.Timeout == 0 {
		config.Timeout = 5 * time.Second
	}
	if config.Method == "" {
		config.Method = "GET"
	}
	if config.ExpectedStatus == 0 {
		config.ExpectedStatus = 200
	}

	client := &http.Client{
		Timeout: config.Timeout,
	}

	return &HTTPHealthChecker{
		url:    url,
		name:   name,
		config: config,
		client: client,
	}
}

func (hhc *HTTPHealthChecker) Name() string {
	return hhc.name
}

func (hhc *HTTPHealthChecker) Check(ctx context.Context) HealthCheckResult {
	start := time.Now()
	result := HealthCheckResult{
		Timestamp: start,
	}

	req, err := http.NewRequestWithContext(ctx, hhc.config.Method, hhc.url, nil)
	if err != nil {
		result.Status = "unhealthy"
		result.Message = fmt.Sprintf("Failed to create request: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	// Add headers
	for key, value := range hhc.config.Headers {
		req.Header.Set(key, value)
	}

	resp, err := hhc.client.Do(req)
	if err != nil {
		result.Status = "unhealthy"
		result.Message = fmt.Sprintf("HTTP request failed: %v", err)
		result.Duration = time.Since(start)
		return result
	}
	defer resp.Body.Close()

	details := map[string]interface{}{
		"status_code": resp.StatusCode,
		"headers":     resp.Header,
	}

	if resp.StatusCode == hhc.config.ExpectedStatus {
		result.Status = "healthy"
		result.Message = "HTTP service healthy"
	} else {
		result.Status = "unhealthy"
		result.Message = fmt.Sprintf("Unexpected status code: %d (expected %d)", resp.StatusCode, hhc.config.ExpectedStatus)
	}

	result.Details = details
	result.Duration = time.Since(start)
	result.LastChecked = time.Now()

	return result
}

// CustomHealthChecker implementation
func NewCustomHealthChecker(name string, checkFunc func(ctx context.Context) HealthCheckResult) *CustomHealthChecker {
	return &CustomHealthChecker{
		name:      name,
		checkFunc: checkFunc,
	}
}

func (chc *CustomHealthChecker) Name() string {
	return chc.name
}

func (chc *CustomHealthChecker) Check(ctx context.Context) HealthCheckResult {
	start := time.Now()
	result := chc.checkFunc(ctx)
	result.Timestamp = start
	result.Duration = time.Since(start)
	result.LastChecked = time.Now()
	return result
}

// Gin handlers for health endpoints
func (hm *HealthManager) GinHealthHandler(c *gin.Context) {
	status := hm.RunChecks(c.Request.Context())

	c.JSON(http.StatusOK, status)
}

func (hm *HealthManager) GinLivenessHandler(c *gin.Context) {
	status := hm.RunLivenessChecks(c.Request.Context())

	if status.Status == "healthy" {
		c.JSON(http.StatusOK, status)
	} else {
		c.JSON(http.StatusServiceUnavailable, status)
	}
}

func (hm *HealthManager) GinReadinessHandler(c *gin.Context) {
	status := hm.RunReadinessChecks(c.Request.Context())

	if status.Status == "healthy" {
		c.JSON(http.StatusOK, status)
	} else {
		c.JSON(http.StatusServiceUnavailable, status)
	}
}

// SetupHealthRoutes sets up health check routes for Gin
func (hm *HealthManager) SetupHealthRoutes(router *gin.Engine) {
	health := router.Group("/health")
	{
		health.GET("", hm.GinHealthHandler)
		health.GET("/live", hm.GinLivenessHandler)
		health.GET("/ready", hm.GinReadinessHandler)
		health.GET("/checks/:name", hm.GinSpecificCheckHandler)
	}
}

func (hm *HealthManager) GinSpecificCheckHandler(c *gin.Context) {
	checkName := c.Param("name")

	hm.mu.RLock()
	checker, exists := hm.checkers[checkName]
	hm.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Health check not found"})
		return
	}

	result := checker.Check(c.Request.Context())
	c.JSON(http.StatusOK, result)
}
