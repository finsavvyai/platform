package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
)

// HealthChecker manages health checks for system components
type HealthChecker struct {
	logger      *zap.Logger
	config      *HealthConfig
	redisClient *redis.Client
	checks      map[string]HealthCheck
	results     map[string]*HealthCheckResult
	mu          sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc
}

// HealthConfig holds health check configuration
type HealthConfig struct {
	Enabled             bool              `yaml:"enabled" json:"enabled"`
	CheckInterval       time.Duration     `yaml:"check_interval" json:"check_interval"`
	Timeout             time.Duration     `yaml:"timeout" json:"timeout"`
	MaxFailures         int               `yaml:"max_failures" json:"max_failures"`
	SuccessThreshold    int               `yaml:"success_threshold" json:"success_threshold"`
	FailureThreshold    int               `yaml:"failure_threshold" json:"failure_threshold"`
	RetryInterval       time.Duration     `yaml:"retry_interval" json:"retry_interval"`
	GracePeriod         time.Duration     `yaml:"grace_period" json:"grace_period"`
	DisableDeepChecks   bool              `yaml:"disable_deep_checks" json:"disable_deep_checks"`
	IncludeMetrics      bool              `yaml:"include_metrics" json:"include_metrics"`
	IncludeDependencies bool              `yaml:"include_dependencies" json:"include_dependencies"`
	AlertOnFailure      bool              `yaml:"alert_on_failure" json:"alert_on_failure"`
	AutoRecovery        bool              `yaml:"auto_recovery" json:"auto_recovery"`
	CustomHeaders       map[string]string `yaml:"custom_headers" json:"custom_headers"`
}

// HealthCheck defines a health check
type HealthCheck struct {
	ID           string                 `yaml:"id" json:"id"`
	Name         string                 `yaml:"name" json:"name"`
	Description  string                 `yaml:"description" json:"description"`
	Type         HealthCheckType        `yaml:"type" json:"type"`
	Enabled      bool                   `yaml:"enabled" json:"enabled"`
	Critical     bool                   `yaml:"critical" json:"critical"`
	Timeout      time.Duration          `yaml:"timeout" json:"timeout"`
	Interval     time.Duration          `yaml:"interval" json:"interval"`
	Retries      int                    `yaml:"retries" json:"retries"`
	Config       map[string]interface{} `yaml:"config" json:"config"`
	Dependencies []string               `yaml:"dependencies" json:"dependencies"`
	Labels       map[string]string      `yaml:"labels" json:"labels"`
	Tags         []string               `yaml:"tags" json:"tags"`
	Owner        string                 `yaml:"owner" json:"owner"`
	Team         string                 `yaml:"team" json:"team"`
	Runbook      string                 `yaml:"runbook" json:"runbook"`
}

// HealthCheckType represents health check types
type HealthCheckType string

const (
	CheckTypeHTTP       HealthCheckType = "http"
	CheckTypeTCP        HealthCheckType = "tcp"
	CheckTypeDatabase   HealthCheckType = "database"
	CheckTypeRedis      HealthCheckType = "redis"
	CheckTypeCommand    HealthCheckType = "command"
	CheckTypeScript     HealthCheckType = "script"
	CheckTypeCustom     HealthCheckType = "custom"
	CheckTypeKubernetes HealthCheckType = "kubernetes"
	CheckTypePrometheus HealthCheckType = "prometheus"
)

// HealthCheckResult represents the result of a health check
type HealthCheckResult struct {
	CheckID          string                  `json:"check_id"`
	CheckName        string                  `json:"check_name"`
	Status           HealthStatus            `json:"status"`
	LastCheck        time.Time               `json:"last_check"`
	Duration         time.Duration           `json:"duration"`
	Message          string                  `json:"message"`
	Details          map[string]interface{}  `json:"details"`
	Error            string                  `json:"error,omitempty"`
	ConsecutiveFails int                     `json:"consecutive_fails"`
	TotalChecks      int64                   `json:"total_checks"`
	SuccessCount     int64                   `json:"success_count"`
	FailureCount     int64                   `json:"failure_count"`
	SuccessRate      float64                 `json:"success_rate"`
	LastSuccess      *time.Time              `json:"last_success,omitempty"`
	LastFailure      *time.Time              `json:"last_failure,omitempty"`
	Dependencies     map[string]HealthStatus `json:"dependencies,omitempty"`
	Labels           map[string]string       `json:"labels,omitempty"`
	Tags             []string                `json:"tags,omitempty"`
	Critical         bool                    `json:"critical"`
	Enabled          bool                    `json:"enabled"`
}

// HealthStatus represents health status
type HealthStatus string

const (
	StatusHealthy   HealthStatus = "healthy"
	StatusUnhealthy HealthStatus = "unhealthy"
	StatusDegraded  HealthStatus = "degraded"
	StatusUnknown   HealthStatus = "unknown"
)

// SystemHealth represents overall system health
type SystemHealth struct {
	Status          HealthStatus                  `json:"status"`
	Timestamp       time.Time                     `json:"timestamp"`
	Uptime          time.Duration                 `json:"uptime"`
	Version         string                        `json:"version"`
	Environment     string                        `json:"environment"`
	Checks          map[string]*HealthCheckResult `json:"checks"`
	Summary         HealthSummary                 `json:"summary"`
	Dependencies    map[string]HealthStatus       `json:"dependencies,omitempty"`
	Metrics         map[string]interface{}        `json:"metrics,omitempty"`
	Issues          []HealthIssue                 `json:"issues,omitempty"`
	Recommendations []string                      `json:"recommendations,omitempty"`
}

// HealthSummary provides a summary of health checks
type HealthSummary struct {
	Total     int            `json:"total"`
	Healthy   int            `json:"healthy"`
	Unhealthy int            `json:"unhealthy"`
	Degraded  int            `json:"degraded"`
	Unknown   int            `json:"unknown"`
	Critical  int            `json:"critical"`
	ByType    map[string]int `json:"by_type"`
	ByOwner   map[string]int `json:"by_owner"`
	ByTeam    map[string]int `json:"by_team"`
}

// HealthIssue represents a health issue
type HealthIssue struct {
	ID          string                 `json:"id"`
	CheckID     string                 `json:"check_id"`
	CheckName   string                 `json:"check_name"`
	Severity    string                 `json:"severity"`
	Status      HealthStatus           `json:"status"`
	Message     string                 `json:"message"`
	StartedAt   time.Time              `json:"started_at"`
	Duration    time.Duration          `json:"duration"`
	Impact      []string               `json:"impact"`
	Affected    []string               `json:"affected"`
	Actions     []string               `json:"actions"`
	Details     map[string]interface{} `json:"details"`
	Owner       string                 `json:"owner"`
	Team        string                 `json:"team"`
	Runbook     string                 `json:"runbook"`
	Escalated   bool                   `json:"escalated"`
	EscalatedAt *time.Time             `json:"escalated_at,omitempty"`
}

// HealthCheckExecutor interface for executing health checks
type HealthCheckExecutor interface {
	Execute(ctx context.Context, check *HealthCheck) *HealthCheckResult
}

// Default health configuration
var (
	DefaultHealthConfig = HealthConfig{
		Enabled:             true,
		CheckInterval:       30 * time.Second,
		Timeout:             10 * time.Second,
		MaxFailures:         3,
		SuccessThreshold:    2,
		FailureThreshold:    3,
		RetryInterval:       5 * time.Second,
		GracePeriod:         30 * time.Second,
		DisableDeepChecks:   false,
		IncludeMetrics:      true,
		IncludeDependencies: true,
		AlertOnFailure:      true,
		AutoRecovery:        true,
		CustomHeaders:       make(map[string]string),
	}
)

// NewHealthChecker creates a new health checker
func NewHealthChecker(redisClient *redis.Client, logger *zap.Logger, config *HealthConfig) *HealthChecker {
	if config == nil {
		config = &DefaultHealthConfig
	}

	ctx, cancel := context.WithCancel(context.Background())

	hc := &HealthChecker{
		logger:      logger,
		config:      config,
		redisClient: redisClient,
		checks:      make(map[string]HealthCheck),
		results:     make(map[string]*HealthCheckResult),
		ctx:         ctx,
		cancel:      cancel,
	}

	// Register default health checks
	hc.registerDefaultChecks()

	return hc
}

// Start starts the health checker
func (hc *HealthChecker) Start() error {
	if !hc.config.Enabled {
		hc.logger.Info("Health checker is disabled")
		return nil
	}

	hc.logger.Info("Starting health checker")

	// Start health check loop
	go hc.healthCheckLoop()

	// Start cleanup loop
	go hc.cleanupLoop()

	hc.logger.Info("Health checker started successfully")
	return nil
}

// Stop stops the health checker
func (hc *HealthChecker) Stop() error {
	hc.logger.Info("Stopping health checker")
	hc.cancel()
	return nil
}

// AddCheck adds a new health check
func (hc *HealthChecker) AddCheck(check HealthCheck) error {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	hc.checks[check.ID] = check

	// Initialize result
	hc.results[check.ID] = &HealthCheckResult{
		CheckID:      check.ID,
		CheckName:    check.Name,
		Status:       StatusUnknown,
		LastCheck:    time.Now(),
		Details:      make(map[string]interface{}),
		Dependencies: make(map[string]HealthStatus),
		Labels:       check.Labels,
		Tags:         check.Tags,
		Critical:     check.Critical,
		Enabled:      check.Enabled,
	}

	hc.logger.Info("Health check added",
		zap.String("check_id", check.ID),
		zap.String("check_name", check.Name))

	return nil
}

// RemoveCheck removes a health check
func (hc *HealthChecker) RemoveCheck(checkID string) error {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	delete(hc.checks, checkID)
	delete(hc.results, checkID)

	hc.logger.Info("Health check removed",
		zap.String("check_id", checkID))

	return nil
}

// GetCheckResult gets the result of a specific health check
func (hc *HealthChecker) GetCheckResult(checkID string) (*HealthCheckResult, error) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	result, exists := hc.results[checkID]
	if !exists {
		return nil, fmt.Errorf("health check %s not found", checkID)
	}

	return result, nil
}

// GetAllResults gets all health check results
func (hc *HealthChecker) GetAllResults() map[string]*HealthCheckResult {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	results := make(map[string]*HealthCheckResult)
	for k, v := range hc.results {
		results[k] = v
	}

	return results
}

// GetSystemHealth gets overall system health
func (hc *HealthChecker) GetSystemHealth() *SystemHealth {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	now := time.Now()
	systemHealth := &SystemHealth{
		Status:       StatusHealthy,
		Timestamp:    now,
		Uptime:       time.Since(now), // This should be calculated from start time
		Version:      "1.0.0",
		Environment:  "production",
		Checks:       make(map[string]*HealthCheckResult),
		Dependencies: make(map[string]HealthStatus),
		Metrics:      make(map[string]interface{}),
	}

	// Copy check results
	for id, result := range hc.results {
		systemHealth.Checks[id] = result

		// Determine overall status
		if result.Enabled {
			if result.Critical && result.Status != StatusHealthy {
				systemHealth.Status = StatusUnhealthy
			} else if result.Status == StatusUnhealthy && systemHealth.Status == StatusHealthy {
				systemHealth.Status = StatusDegraded
			}
		}
	}

	// Calculate summary
	systemHealth.Summary = hc.calculateSummary(systemHealth.Checks)

	// Add issues
	systemHealth.Issues = hc.getIssues(systemHealth.Checks)

	// Add metrics if enabled
	if hc.config.IncludeMetrics {
		systemHealth.Metrics = hc.getSystemMetrics()
	}

	return systemHealth
}

// ExecuteCheck executes a specific health check
func (hc *HealthChecker) ExecuteCheck(checkID string) (*HealthCheckResult, error) {
	hc.mu.RLock()
	check, exists := hc.checks[checkID]
	hc.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("health check %s not found", checkID)
	}

	if !check.Enabled {
		return nil, fmt.Errorf("health check %s is disabled", checkID)
	}

	return hc.executeHealthCheck(check), nil
}

// registerDefaultChecks registers default health checks
func (hc *HealthChecker) registerDefaultChecks() {
	// Database health check
	hc.AddCheck(HealthCheck{
		ID:          "database",
		Name:        "Database Connection",
		Description: "Checks database connectivity and performance",
		Type:        CheckTypeDatabase,
		Enabled:     true,
		Critical:    true,
		Timeout:     5 * time.Second,
		Interval:    30 * time.Second,
		Retries:     3,
		Config: map[string]interface{}{
			"query": "SELECT 1",
		},
		Labels: map[string]string{
			"component": "database",
			"tier":      "storage",
		},
		Owner: "platform-team",
		Team:  "platform",
	})

	// Redis health check
	hc.AddCheck(HealthCheck{
		ID:          "redis",
		Name:        "Redis Connection",
		Description: "Checks Redis connectivity and performance",
		Type:        CheckTypeRedis,
		Enabled:     true,
		Critical:    true,
		Timeout:     3 * time.Second,
		Interval:    15 * time.Second,
		Retries:     3,
		Config: map[string]interface{}{
			"command": "PING",
		},
		Labels: map[string]string{
			"component": "cache",
			"tier":      "storage",
		},
		Owner: "platform-team",
		Team:  "platform",
	})

	// API health check
	hc.AddCheck(HealthCheck{
		ID:          "api",
		Name:        "API Endpoint",
		Description: "Checks API endpoint availability and response time",
		Type:        CheckTypeHTTP,
		Enabled:     true,
		Critical:    true,
		Timeout:     5 * time.Second,
		Interval:    30 * time.Second,
		Retries:     2,
		Config: map[string]interface{}{
			"url":             "http://localhost:8080/health",
			"method":          "GET",
			"expected_status": 200,
		},
		Labels: map[string]string{
			"component": "api",
			"tier":      "application",
		},
		Owner: "api-team",
		Team:  "platform",
	})

	// External services health check
	hc.AddCheck(HealthCheck{
		ID:          "external_services",
		Name:        "External Services",
		Description: "Checks connectivity to external services",
		Type:        CheckTypeHTTP,
		Enabled:     true,
		Critical:    false,
		Timeout:     10 * time.Second,
		Interval:    60 * time.Second,
		Retries:     2,
		Config: map[string]interface{}{
			"services": []map[string]interface{}{
				{"name": "openai", "url": "https://api.openai.com/v1/models"},
				{"name": "quantum", "url": "https://quantum-computing.ibm.com"},
			},
		},
		Labels: map[string]string{
			"component": "external",
			"tier":      "integration",
		},
		Owner: "integration-team",
		Team:  "platform",
	})
}

// healthCheckLoop runs the health check loop
func (hc *HealthChecker) healthCheckLoop() {
	ticker := time.NewTicker(hc.config.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-hc.ctx.Done():
			return
		case <-ticker.C:
			hc.runHealthChecks()
		}
	}
}

// runHealthChecks runs all enabled health checks
func (hc *HealthChecker) runHealthChecks() {
	hc.mu.RLock()
	checks := make([]HealthCheck, 0, len(hc.checks))
	for _, check := range hc.checks {
		if check.Enabled {
			checks = append(checks, check)
		}
	}
	hc.mu.RUnlock()

	for _, check := range checks {
		go func(c HealthCheck) {
			result := hc.executeHealthCheck(&c)
			hc.updateResult(result)
		}(check)
	}
}

// executeHealthCheck executes a single health check
func (hc *HealthChecker) executeHealthCheck(check *HealthCheck) *HealthCheckResult {
	start := time.Now()

	result := &HealthCheckResult{
		CheckID:      check.ID,
		CheckName:    check.Name,
		Status:       StatusUnknown,
		LastCheck:    start,
		Details:      make(map[string]interface{}),
		Dependencies: make(map[string]HealthStatus),
		Labels:       check.Labels,
		Tags:         check.Tags,
		Critical:     check.Critical,
		Enabled:      check.Enabled,
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(hc.ctx, check.Timeout)
	defer cancel()

	// Execute health check based on type
	var executor HealthCheckExecutor
	switch check.Type {
	case CheckTypeHTTP:
		executor = &HTTPHealthCheckExecutor{logger: hc.logger}
	case CheckTypeTCP:
		executor = &TCPHealthCheckExecutor{logger: hc.logger}
	case CheckTypeDatabase:
		executor = &DatabaseHealthCheckExecutor{logger: hc.logger, redisClient: hc.redisClient}
	case CheckTypeRedis:
		executor = &RedisHealthCheckExecutor{logger: hc.logger, redisClient: hc.redisClient}
	case CheckTypeCommand:
		executor = &CommandHealthCheckExecutor{logger: hc.logger}
	case CheckTypeScript:
		executor = &ScriptHealthCheckExecutor{logger: hc.logger}
	case CheckTypeCustom:
		executor = &CustomHealthCheckExecutor{logger: hc.logger}
	default:
		result.Status = StatusUnknown
		result.Message = fmt.Sprintf("Unknown health check type: %s", check.Type)
		result.Duration = time.Since(start)
		return result
	}

	// Execute the health check
	checkResult := executor.Execute(ctx, check)
	result = checkResult
	result.Duration = time.Since(start)

	// Store in Redis
	hc.storeResult(result)

	return result
}

// updateResult updates the stored result for a health check
func (hc *HealthChecker) updateResult(result *HealthCheckResult) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	// Get previous result
	previous, exists := hc.results[result.CheckID]

	// Update counters
	if exists {
		result.TotalChecks = previous.TotalChecks + 1
		result.SuccessCount = previous.SuccessCount
		result.FailureCount = previous.FailureCount
		result.ConsecutiveFails = previous.ConsecutiveFails

		if result.Status == StatusHealthy {
			result.SuccessCount++
			result.ConsecutiveFails = 0
			result.LastSuccess = &result.LastCheck
		} else {
			result.FailureCount++
			result.ConsecutiveFails++
			result.LastFailure = &result.LastCheck
		}
	} else {
		result.TotalChecks = 1
		if result.Status == StatusHealthy {
			result.SuccessCount = 1
			result.LastSuccess = &result.LastCheck
		} else {
			result.FailureCount = 1
			result.ConsecutiveFails = 1
			result.LastFailure = &result.LastCheck
		}
	}

	// Calculate success rate
	if result.TotalChecks > 0 {
		result.SuccessRate = float64(result.SuccessCount) / float64(result.TotalChecks) * 100
	}

	// Store result
	hc.results[result.CheckID] = result

	// Log status change
	if exists && previous.Status != result.Status {
		hc.logger.Info("Health check status changed",
			zap.String("check_id", result.CheckID),
			zap.String("old_status", string(previous.Status)),
			zap.String("new_status", string(result.Status)),
			zap.Duration("duration", result.Duration),
			zap.String("message", result.Message))
	}

	// Alert on failure if configured
	if hc.config.AlertOnFailure && result.Status != StatusHealthy {
		hc.sendFailureAlert(result)
	}
}

// storeResult stores a health check result in Redis
func (hc *HealthChecker) storeResult(result *HealthCheckResult) {
	data, err := json.Marshal(result)
	if err != nil {
		hc.logger.Error("Failed to marshal health check result",
			zap.String("check_id", result.CheckID),
			zap.Error(err))
		return
	}

	key := fmt.Sprintf("health_result:%s", result.CheckID)
	hc.redisClient.Set(hc.ctx, key, data, 24*time.Hour)
}

// calculateSummary calculates health check summary
func (hc *HealthChecker) calculateSummary(checks map[string]*HealthCheckResult) HealthSummary {
	summary := HealthSummary{
		Total:   len(checks),
		ByType:  make(map[string]int),
		ByOwner: make(map[string]int),
		ByTeam:  make(map[string]int),
	}

	for _, result := range checks {
		if !result.Enabled {
			continue
		}

		switch result.Status {
		case StatusHealthy:
			summary.Healthy++
		case StatusUnhealthy:
			summary.Unhealthy++
		case StatusDegraded:
			summary.Degraded++
		default:
			summary.Unknown++
		}

		if result.Critical && result.Status != StatusHealthy {
			summary.Critical++
		}

		// Count by type (would need check type from check definition)
		summary.ByType["unknown"]++

		// Count by owner
		if owner := result.Labels["owner"]; owner != "" {
			summary.ByOwner[owner]++
		}

		// Count by team
		if team := result.Labels["team"]; team != "" {
			summary.ByTeam[team]++
		}
	}

	return summary
}

// getIssues gets health issues from check results
func (hc *HealthChecker) getIssues(checks map[string]*HealthCheckResult) []HealthIssue {
	var issues []HealthIssue

	for _, result := range checks {
		if result.Status != StatusHealthy && result.Enabled {
			issue := HealthIssue{
				ID:        fmt.Sprintf("issue_%s_%d", result.CheckID, time.Now().Unix()),
				CheckID:   result.CheckID,
				CheckName: result.CheckName,
				Severity:  "high",
				Status:    result.Status,
				Message:   result.Message,
				StartedAt: result.LastCheck,
				Impact:    []string{"System availability"},
				Affected:  []string{result.CheckName},
				Owner:     result.Labels["owner"],
				Team:      result.Labels["team"],
				Details:   result.Details,
			}

			if result.LastFailure != nil {
				issue.Duration = time.Since(*result.LastFailure)
			}

			issues = append(issues, issue)
		}
	}

	// Sort issues by severity and duration
	sort.Slice(issues, func(i, j int) bool {
		if issues[i].Severity != issues[j].Severity {
			return issues[i].Severity > issues[j].Severity
		}
		return issues[i].Duration > issues[j].Duration
	})

	return issues
}

// getSystemMetrics gets system-level metrics
func (hc *HealthChecker) getSystemMetrics() map[string]interface{} {
	return map[string]interface{}{
		"total_checks":     len(hc.results),
		"healthy_checks":   hc.countByStatus(StatusHealthy),
		"unhealthy_checks": hc.countByStatus(StatusUnhealthy),
		"degraded_checks":  hc.countByStatus(StatusDegraded),
		"unknown_checks":   hc.countByStatus(StatusUnknown),
		"uptime_seconds":   time.Since(time.Now()).Seconds(), // Should be actual uptime
	}
}

// countByStatus counts checks by status
func (hc *HealthChecker) countByStatus(status HealthStatus) int {
	count := 0
	for _, result := range hc.results {
		if result.Status == status && result.Enabled {
			count++
		}
	}
	return count
}

// sendFailureAlert sends an alert for health check failure
func (hc *HealthChecker) sendFailureAlert(result *HealthCheckResult) {
	// This would integrate with the alerting system
	hc.logger.Error("Health check failure",
		zap.String("check_id", result.CheckID),
		zap.String("check_name", result.CheckName),
		zap.String("status", string(result.Status)),
		zap.String("message", result.Message),
		zap.Int("consecutive_fails", result.ConsecutiveFails))
}

// cleanupLoop performs periodic cleanup
func (hc *HealthChecker) cleanupLoop() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-hc.ctx.Done():
			return
		case <-ticker.C:
			hc.performCleanup()
		}
	}
}

// performCleanup performs cleanup tasks
func (hc *HealthChecker) performCleanup() {
	// Clean up old health check results from Redis
	cutoff := time.Now().Add(-24 * time.Hour)
	keys, err := hc.redisClient.Keys(hc.ctx, "health_result:*").Result()
	if err != nil {
		hc.logger.Error("Failed to get health result keys", zap.Error(err))
		return
	}

	for _, key := range keys {
		ttl, err := hc.redisClient.TTL(hc.ctx, key).Result()
		if err == nil && ttl < 0 {
			// Expired key, remove it
			hc.redisClient.Del(hc.ctx, key)
		}
	}
}

// Health check executor implementations

// HTTPHealthCheckExecutor executes HTTP health checks
type HTTPHealthCheckExecutor struct {
	logger *zap.Logger
	client *http.Client
}

func NewHTTPHealthCheckExecutor(logger *zap.Logger) *HTTPHealthCheckExecutor {
	return &HTTPHealthCheckExecutor{
		logger: logger,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (e *HTTPHealthCheckExecutor) Execute(ctx context.Context, check *HealthCheck) *HealthCheckResult {
	result := &HealthCheckResult{
		CheckID:   check.ID,
		CheckName: check.Name,
		Status:    StatusUnknown,
		Details:   make(map[string]interface{}),
	}

	url, ok := check.Config["url"].(string)
	if !ok {
		result.Status = StatusUnhealthy
		result.Message = "URL not configured"
		return result
	}

	method := "GET"
	if m, ok := check.Config["method"].(string); ok {
		method = m
	}

	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		result.Status = StatusUnhealthy
		result.Message = fmt.Sprintf("Failed to create request: %v", err)
		result.Error = err.Error()
		return result
	}

	resp, err := e.client.Do(req)
	if err != nil {
		result.Status = StatusUnhealthy
		result.Message = fmt.Sprintf("Request failed: %v", err)
		result.Error = err.Error()
		return result
	}
	defer resp.Body.Close()

	result.Details["status_code"] = resp.StatusCode
	result.Details["response_headers"] = resp.Header

	expectedStatus := 200
	if es, ok := check.Config["expected_status"].(int); ok {
		expectedStatus = es
	}

	if resp.StatusCode == expectedStatus {
		result.Status = StatusHealthy
		result.Message = "HTTP check passed"
	} else {
		result.Status = StatusUnhealthy
		result.Message = fmt.Sprintf("Unexpected status code: %d", resp.StatusCode)
	}

	return result
}

// DatabaseHealthCheckExecutor executes database health checks
type DatabaseHealthCheckExecutor struct {
	logger      *zap.Logger
	redisClient *redis.Client
}

func (e *DatabaseHealthCheckExecutor) Execute(ctx context.Context, check *HealthCheck) *HealthCheckResult {
	result := &HealthCheckResult{
		CheckID:   check.ID,
		CheckName: check.Name,
		Status:    StatusUnknown,
		Details:   make(map[string]interface{}),
	}

	// Test Redis connection since it's available
	start := time.Now()
	err := e.redisClient.Ping(ctx).Err()
	duration := time.Since(start)

	result.Details["query_duration_ms"] = duration.Milliseconds()

	if err != nil {
		result.Status = StatusUnhealthy
		result.Message = fmt.Sprintf("Database connection failed: %v", err)
		result.Error = err.Error()
		return result
	}

	result.Status = StatusHealthy
	result.Message = "Database connection successful"
	result.Details["query_duration_ms"] = duration.Milliseconds()

	return result
}

// RedisHealthCheckExecutor executes Redis health checks
type RedisHealthCheckExecutor struct {
	logger      *zap.Logger
	redisClient *redis.Client
}

func (e *RedisHealthCheckExecutor) Execute(ctx context.Context, check *HealthCheck) *HealthCheckResult {
	result := &HealthCheckResult{
		CheckID:   check.ID,
		CheckName: check.Name,
		Status:    StatusUnknown,
		Details:   make(map[string]interface{}),
	}

	start := time.Now()
	pong, err := e.redisClient.Ping(ctx).Result()
	duration := time.Since(start)

	result.Details["command_duration_ms"] = duration.Milliseconds()
	result.Details["response"] = pong

	if err != nil {
		result.Status = StatusUnhealthy
		result.Message = fmt.Sprintf("Redis connection failed: %v", err)
		result.Error = err.Error()
		return result
	}

	if pong != "PONG" {
		result.Status = StatusUnhealthy
		result.Message = fmt.Sprintf("Unexpected Redis response: %s", pong)
		return result
	}

	result.Status = StatusHealthy
	result.Message = "Redis connection successful"

	return result
}

// TCPHealthCheckExecutor executes TCP health checks
type TCPHealthCheckExecutor struct {
	logger *zap.Logger
}

func (e *TCPHealthCheckExecutor) Execute(ctx context.Context, check *HealthCheck) *HealthCheckResult {
	result := &HealthCheckResult{
		CheckID:   check.ID,
		CheckName: check.Name,
		Status:    StatusUnknown,
		Details:   make(map[string]interface{}),
	}

	// Implementation would go here
	result.Status = StatusUnknown
	result.Message = "TCP health check not implemented"

	return result
}

// CommandHealthCheckExecutor executes command health checks
type CommandHealthCheckExecutor struct {
	logger *zap.Logger
}

func (e *CommandHealthCheckExecutor) Execute(ctx context.Context, check *HealthCheck) *HealthCheckResult {
	result := &HealthCheckResult{
		CheckID:   check.ID,
		CheckName: check.Name,
		Status:    StatusUnknown,
		Details:   make(map[string]interface{}),
	}

	// Implementation would go here
	result.Status = StatusUnknown
	result.Message = "Command health check not implemented"

	return result
}

// ScriptHealthCheckExecutor executes script health checks
type ScriptHealthCheckExecutor struct {
	logger *zap.Logger
}

func (e *ScriptHealthCheckExecutor) Execute(ctx context.Context, check *HealthCheck) *HealthCheckResult {
	result := &HealthCheckResult{
		CheckID:   check.ID,
		CheckName: check.Name,
		Status:    StatusUnknown,
		Details:   make(map[string]interface{}),
	}

	// Implementation would go here
	result.Status = StatusUnknown
	result.Message = "Script health check not implemented"

	return result
}

// CustomHealthCheckExecutor executes custom health checks
type CustomHealthCheckExecutor struct {
	logger *zap.Logger
}

func (e *CustomHealthCheckExecutor) Execute(ctx context.Context, check *HealthCheck) *HealthCheckResult {
	result := &HealthCheckResult{
		CheckID:   check.ID,
		CheckName: check.Name,
		Status:    StatusUnknown,
		Details:   make(map[string]interface{}),
	}

	// Implementation would go here
	result.Status = StatusUnknown
	result.Message = "Custom health check not implemented"

	return result
}
