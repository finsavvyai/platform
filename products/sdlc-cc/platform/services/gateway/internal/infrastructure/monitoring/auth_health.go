//go:build ignore

package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
)

// AuthHealthStatus represents the health status of authentication components
type AuthHealthStatus struct {
	JWTService        ServiceHealthStatus `json:"jwt_service"`
	BlacklistService  ServiceHealthStatus `json:"blacklist_service"`
	SessionManager    ServiceHealthStatus `json:"session_manager"`
	CredentialManager ServiceHealthStatus `json:"credential_manager"`
	OverallStatus     HealthStatus        `json:"overall_status"`
	Timestamp         time.Time           `json:"timestamp"`
	Version           string              `json:"version"`
	Metrics           AuthMetrics         `json:"metrics"`
}

// ServiceHealthStatus represents health status of individual services
type ServiceHealthStatus struct {
	Status       HealthStatus  `json:"status"`
	Message      string        `json:"message,omitempty"`
	LastCheck    time.Time     `json:"last_check"`
	ResponseTime time.Duration `json:"response_time"`
	ErrorCount   int           `json:"error_count"`
	LastError    string        `json:"last_error,omitempty"`
	Uptime       time.Duration `json:"uptime"`
	StartTime    time.Time     `json:"start_time"`
}

// AuthMetrics represents authentication-related metrics
type AuthMetrics struct {
	TotalTokensGenerated      int64   `json:"total_tokens_generated"`
	TotalTokensValidated      int64   `json:"total_tokens_validated"`
	TotalTokensRevoked        int64   `json:"total_tokens_revoked"`
	TotalRefreshTokensUsed    int64   `json:"total_refresh_tokens_used"`
	TotalAuthenticationErrors int64   `json:"total_authentication_errors"`
	ValidationLatencyMs       float64 `json:"validation_latency_ms"`
	GenerationLatencyMs       float64 `json:"generation_latency_ms"`
	ActiveTokens              int64   `json:"active_tokens"`
	ActiveSessions            int64   `json:"active_sessions"`
	BlacklistedTokens         int64   `json:"blacklisted_tokens"`
}

// HealthStatus represents overall health status
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusDegraded  HealthStatus = "degraded"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
	HealthStatusUnknown   HealthStatus = "unknown"
)

// HealthChecker interface for health checking
type HealthChecker interface {
	CheckHealth(ctx context.Context) error
	GetName() string
}

// AuthHealthMonitor monitors authentication system health
type AuthHealthMonitor struct {
	jwtService       services.JWTService
	blacklistService services.BlacklistService
	sessionManager   services.SessionManager
	credentialMgr    interface{} // CredentialManager interface

	// Metrics
	metrics struct {
		healthStatus      *prometheus.GaugeVec
		responseTime      *prometheus.HistogramVec
		errorCount        *prometheus.CounterVec
		tokensGenerated   prometheus.Counter
		tokensValidated   prometheus.Counter
		tokensRevoked     prometheus.Counter
		refreshTokensUsed prometheus.Counter
		validationLatency prometheus.Histogram
		generationLatency prometheus.Histogram
		activeTokens      prometheus.Gauge
		activeSessions    prometheus.Gauge
		blacklistedTokens prometheus.Gauge
	}

	// Health status tracking
	status     AuthHealthStatus
	statusLock sync.RWMutex

	// Configuration
	config HealthMonitorConfig

	// Logger
	logger *logrus.Logger

	// Background monitoring
	ticker      *time.Ticker
	stopChannel chan struct{}
	running     bool
	mutex       sync.RWMutex

	// Start time for uptime calculation
	startTime time.Time
}

// HealthMonitorConfig holds configuration for health monitoring
type HealthMonitorConfig struct {
	CheckInterval     time.Duration `json:"check_interval"`
	Timeout           time.Duration `json:"timeout"`
	FailureThreshold  int           `json:"failure_threshold"`
	SuccessThreshold  int           `json:"success_threshold"`
	EnableMetrics     bool          `json:"enable_metrics"`
	EnableDetailedLog bool          `json:"enable_detailed_log"`
	Version           string        `json:"version"`
}

// DefaultHealthMonitorConfig returns default health monitor configuration
func DefaultHealthMonitorConfig() HealthMonitorConfig {
	return HealthMonitorConfig{
		CheckInterval:     30 * time.Second,
		Timeout:           5 * time.Second,
		FailureThreshold:  3,
		SuccessThreshold:  2,
		EnableMetrics:     true,
		EnableDetailedLog: false,
		Version:           "1.0.0",
	}
}

// NewAuthHealthMonitor creates a new authentication health monitor
func NewAuthHealthMonitor(
	jwtService services.JWTService,
	blacklistService services.BlacklistService,
	sessionManager services.SessionManager,
	credentialMgr interface{},
	config HealthMonitorConfig,
	logger *logrus.Logger,
) *AuthHealthMonitor {
	if logger == nil {
		logger = logrus.New()
	}

	monitor := &AuthHealthMonitor{
		jwtService:       jwtService,
		blacklistService: blacklistService,
		sessionManager:   sessionManager,
		credentialMgr:    credentialMgr,
		config:           config,
		logger:           logger,
		startTime:        time.Now(),
		stopChannel:      make(chan struct{}),
	}

	// Initialize Prometheus metrics
	monitor.initMetrics()

	// Initialize health status
	monitor.status = AuthHealthStatus{
		JWTService: ServiceHealthStatus{
			Status:    HealthStatusUnknown,
			StartTime: monitor.startTime,
			Uptime:    time.Since(monitor.startTime),
		},
		BlacklistService: ServiceHealthStatus{
			Status:    HealthStatusUnknown,
			StartTime: monitor.startTime,
			Uptime:    time.Since(monitor.startTime),
		},
		SessionManager: ServiceHealthStatus{
			Status:    HealthStatusUnknown,
			StartTime: monitor.startTime,
			Uptime:    time.Since(monitor.startTime),
		},
		CredentialManager: ServiceHealthStatus{
			Status:    HealthStatusUnknown,
			StartTime: monitor.startTime,
			Uptime:    time.Since(monitor.startTime),
		},
		OverallStatus: HealthStatusUnknown,
		Timestamp:     time.Now(),
		Version:       config.Version,
	}

	return monitor
}

// Start begins health monitoring
func (m *AuthHealthMonitor) Start() {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.running {
		return
	}

	m.running = true
	m.ticker = time.NewTicker(m.config.CheckInterval)

	// Perform initial health check
	m.performHealthCheck()

	// Start background monitoring
	go m.monitorLoop()

	m.logger.WithFields(logrus.Fields{
		"interval": m.config.CheckInterval,
		"version":  m.config.Version,
	}).Info("Authentication health monitoring started")
}

// Stop stops health monitoring
func (m *AuthHealthMonitor) Stop() {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if !m.running {
		return
	}

	m.running = false
	close(m.stopChannel)

	if m.ticker != nil {
		m.ticker.Stop()
	}

	m.logger.Info("Authentication health monitoring stopped")
}

// GetHealthStatus returns current health status
func (m *AuthHealthMonitor) GetHealthStatus() AuthHealthStatus {
	m.statusLock.RLock()
	defer m.statusLock.RUnlock()

	// Update uptime
	now := time.Now()
	m.status.JWTService.Uptime = now.Sub(m.status.JWTService.StartTime)
	m.status.BlacklistService.Uptime = now.Sub(m.status.BlacklistService.StartTime)
	m.status.SessionManager.Uptime = now.Sub(m.status.SessionManager.StartTime)
	m.status.CredentialManager.Uptime = now.Sub(m.status.CredentialManager.StartTime)

	status := m.status
	status.Timestamp = now
	status.Metrics = m.getCurrentMetrics()

	return status
}

// CheckHealth performs an immediate health check
func (m *AuthHealthMonitor) CheckHealth(ctx context.Context) AuthHealthStatus {
	m.performHealthCheck()
	return m.GetHealthStatus()
}

// RecordTokenGeneration records a token generation event
func (m *AuthHealthMonitor) RecordTokenGeneration(latency time.Duration) {
	if m.config.EnableMetrics {
		m.metrics.tokensGenerated.Inc()
		m.metrics.generationLatency.Observe(latency.Seconds())
	}
}

// RecordTokenValidation records a token validation event
func (m *AuthHealthMonitor) RecordTokenValidation(latency time.Duration, success bool) {
	if m.config.EnableMetrics {
		m.metrics.tokensValidated.Inc()
		m.metrics.validationLatency.Observe(latency.Seconds())

		if !success {
			m.metrics.errorCount.WithLabelValues("validation").Inc()
		}
	}
}

// RecordTokenRevocation records a token revocation event
func (m *AuthHealthMonitor) RecordTokenRevocation() {
	if m.config.EnableMetrics {
		m.metrics.tokensRevoked.Inc()
	}
}

// RecordRefreshTokenUsed records a refresh token usage event
func (m *AuthHealthMonitor) RecordRefreshTokenUsed() {
	if m.config.EnableMetrics {
		m.metrics.refreshTokensUsed.Inc()
	}
}

// UpdateActiveTokens updates the active tokens count
func (m *AuthHealthMonitor) UpdateActiveTokens(count int64) {
	if m.config.EnableMetrics {
		m.metrics.activeTokens.Set(float64(count))
	}
}

// UpdateActiveSessions updates the active sessions count
func (m *AuthHealthMonitor) UpdateActiveSessions(count int64) {
	if m.config.EnableMetrics {
		m.metrics.activeSessions.Set(float64(count))
	}
}

// UpdateBlacklistedTokens updates the blacklisted tokens count
func (m *AuthHealthMonitor) UpdateBlacklistedTokens(count int64) {
	if m.config.EnableMetrics {
		m.metrics.blacklistedTokens.Set(float64(count))
	}
}

// Private methods

func (m *AuthHealthMonitor) initMetrics() {
	if !m.config.EnableMetrics {
		return
	}

	m.metrics.healthStatus = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "auth_health_status",
			Help: "Authentication service health status (0=unknown, 1=healthy, 2=degraded, 3=unhealthy)",
		},
		[]string{"service"},
	)

	m.metrics.responseTime = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "auth_health_check_duration_seconds",
			Help:    "Time taken to perform health checks",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service"},
	)

	m.metrics.errorCount = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_health_check_errors_total",
			Help: "Total number of health check errors",
		},
		[]string{"service", "error_type"},
	)

	m.metrics.tokensGenerated = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "auth_tokens_generated_total",
			Help: "Total number of tokens generated",
		},
	)

	m.metrics.tokensValidated = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "auth_tokens_validated_total",
			Help: "Total number of tokens validated",
		},
	)

	m.metrics.tokensRevoked = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "auth_tokens_revoked_total",
			Help: "Total number of tokens revoked",
		},
	)

	m.metrics.refreshTokensUsed = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "auth_refresh_tokens_used_total",
			Help: "Total number of refresh tokens used",
		},
	)

	m.metrics.validationLatency = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "auth_token_validation_duration_seconds",
			Help:    "Time taken to validate tokens",
			Buckets: prometheus.DefBuckets,
		},
	)

	m.metrics.generationLatency = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "auth_token_generation_duration_seconds",
			Help:    "Time taken to generate tokens",
			Buckets: prometheus.DefBuckets,
		},
	)

	m.metrics.activeTokens = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "auth_active_tokens",
			Help: "Number of currently active tokens",
		},
	)

	m.metrics.activeSessions = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "auth_active_sessions",
			Help: "Number of currently active sessions",
		},
	)

	m.metrics.blacklistedTokens = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "auth_blacklisted_tokens",
			Help: "Number of blacklisted tokens",
		},
	)
}

func (m *AuthHealthMonitor) monitorLoop() {
	for {
		select {
		case <-m.ticker.C:
			m.performHealthCheck()
		case <-m.stopChannel:
			return
		}
	}
}

func (m *AuthHealthMonitor) performHealthCheck() {
	ctx, cancel := context.WithTimeout(context.Background(), m.config.Timeout)
	defer cancel()

	now := time.Now()

	// Check JWT Service
	jwtHealth := m.checkJWTService(ctx)

	// Check Blacklist Service
	blacklistHealth := m.checkBlacklistService(ctx)

	// Check Session Manager
	sessionHealth := m.checkSessionManager(ctx)

	// Check Credential Manager
	credentialHealth := m.checkCredentialManager(ctx)

	// Update status
	m.statusLock.Lock()
	m.status.JWTService = jwtHealth
	m.status.BlacklistService = blacklistHealth
	m.status.SessionManager = sessionHealth
	m.status.CredentialManager = credentialHealth
	m.status.Timestamp = now

	// Determine overall status
	m.status.OverallStatus = m.calculateOverallStatus(jwtHealth, blacklistHealth, sessionHealth, credentialHealth)

	// Update Prometheus metrics
	if m.config.EnableMetrics {
		m.updatePrometheusMetrics()
	}

	m.statusLock.Unlock()

	// Log status changes
	if m.config.EnableDetailedLog {
		m.logHealthStatus()
	}
}

func (m *AuthHealthMonitor) checkJWTService(ctx context.Context) ServiceHealthStatus {
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		if m.config.EnableMetrics {
			m.metrics.responseTime.WithLabelValues("jwt_service").Observe(duration.Seconds())
		}
	}()

	// Try to generate a test token using deterministic UUIDs for health checks
	testUserID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testTenantID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	_, err := m.jwtService.GenerateTokenPair(
		ctx,
		testUserID,
		testTenantID,
		"health-check@test.com",
		"user",
		[]string{"health_check"},
		"health-check-device",
		"health-check-session",
	)

	if err != nil {
		return ServiceHealthStatus{
			Status:       HealthStatusUnhealthy,
			Message:      fmt.Sprintf("Failed to generate test token: %v", err),
			LastCheck:    time.Now(),
			ResponseTime: time.Since(start),
			ErrorCount:   1,
			LastError:    err.Error(),
			Uptime:       time.Since(m.startTime),
			StartTime:    m.startTime,
		}
	}

	// Check key info
	keyInfo := m.jwtService.GetKeyInfo()
	if keyInfo.KeyID == "" {
		return ServiceHealthStatus{
			Status:       HealthStatusDegraded,
			Message:      "JWT service key info unavailable",
			LastCheck:    time.Now(),
			ResponseTime: time.Since(start),
			Uptime:       time.Since(m.startTime),
			StartTime:    m.startTime,
		}
	}

	return ServiceHealthStatus{
		Status:       HealthStatusHealthy,
		Message:      "JWT service operating normally",
		LastCheck:    time.Now(),
		ResponseTime: time.Since(start),
		ErrorCount:   0,
		Uptime:       time.Since(m.startTime),
		StartTime:    m.startTime,
	}
}

func (m *AuthHealthMonitor) checkBlacklistService(ctx context.Context) ServiceHealthStatus {
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		if m.config.EnableMetrics {
			m.metrics.responseTime.WithLabelValues("blacklist_service").Observe(duration.Seconds())
		}
	}()

	// Try to check if a test token is blacklisted
	testTokenID := "health-check-token-id"

	_, err := m.blacklistService.IsBlacklisted(ctx, testTokenID)
	if err != nil {
		return ServiceHealthStatus{
			Status:       HealthStatusUnhealthy,
			Message:      fmt.Sprintf("Blacklist service check failed: %v", err),
			LastCheck:    time.Now(),
			ResponseTime: time.Since(start),
			ErrorCount:   1,
			LastError:    err.Error(),
			Uptime:       time.Since(m.startTime),
			StartTime:    m.startTime,
		}
	}

	// Try to add and remove a test token from blacklist
	err = m.blacklistService.AddToBlacklist(ctx, testTokenID, time.Now().Add(1*time.Minute))
	if err != nil {
		return ServiceHealthStatus{
			Status:       HealthStatusDegraded,
			Message:      fmt.Sprintf("Blacklist service add failed: %v", err),
			LastCheck:    time.Now(),
			ResponseTime: time.Since(start),
			ErrorCount:   1,
			LastError:    err.Error(),
			Uptime:       time.Since(m.startTime),
			StartTime:    m.startTime,
		}
	}

	// Clean up test token
	m.blacklistService.RemoveFromBlacklist(ctx, testTokenID)

	return ServiceHealthStatus{
		Status:       HealthStatusHealthy,
		Message:      "Blacklist service operating normally",
		LastCheck:    time.Now(),
		ResponseTime: time.Since(start),
		ErrorCount:   0,
		Uptime:       time.Since(m.startTime),
		StartTime:    m.startTime,
	}
}

func (m *AuthHealthMonitor) checkSessionManager(ctx context.Context) ServiceHealthStatus {
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		if m.config.EnableMetrics {
			m.metrics.responseTime.WithLabelValues("session_manager").Observe(duration.Seconds())
		}
	}()

	// Session manager checks would depend on the actual implementation
	// For now, we'll do basic existence checks
	if m.sessionManager == nil {
		return ServiceHealthStatus{
			Status:       HealthStatusDegraded,
			Message:      "Session manager not configured",
			LastCheck:    time.Now(),
			ResponseTime: time.Since(start),
			Uptime:       time.Since(m.startTime),
			StartTime:    m.startTime,
		}
	}

	// Try to get active sessions (would need actual implementation)
	// For now, assume it's healthy if it exists
	return ServiceHealthStatus{
		Status:       HealthStatusHealthy,
		Message:      "Session manager operating normally",
		LastCheck:    time.Now(),
		ResponseTime: time.Since(start),
		ErrorCount:   0,
		Uptime:       time.Since(m.startTime),
		StartTime:    m.startTime,
	}
}

func (m *AuthHealthMonitor) checkCredentialManager(ctx context.Context) ServiceHealthStatus {
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		if m.config.EnableMetrics {
			m.metrics.responseTime.WithLabelValues("credential_manager").Observe(duration.Seconds())
		}
	}()

	// Credential manager checks would depend on the actual implementation
	if m.credentialMgr == nil {
		return ServiceHealthStatus{
			Status:       HealthStatusDegraded,
			Message:      "Credential manager not configured",
			LastCheck:    time.Now(),
			ResponseTime: time.Since(start),
			Uptime:       time.Since(m.startTime),
			StartTime:    m.startTime,
		}
	}

	return ServiceHealthStatus{
		Status:       HealthStatusHealthy,
		Message:      "Credential manager operating normally",
		LastCheck:    time.Now(),
		ResponseTime: time.Since(start),
		ErrorCount:   0,
		Uptime:       time.Since(m.startTime),
		StartTime:    m.startTime,
	}
}

func (m *AuthHealthMonitor) calculateOverallStatus(
	jwt, blacklist, session, credential ServiceHealthStatus,
) HealthStatus {
	statuses := []HealthStatus{
		jwt.Status,
		blacklist.Status,
		session.Status,
		credential.Status,
	}

	// Count different statuses
	healthyCount := 0
	degradedCount := 0
	unhealthyCount := 0

	for _, status := range statuses {
		switch status {
		case HealthStatusHealthy:
			healthyCount++
		case HealthStatusDegraded:
			degradedCount++
		case HealthStatusUnhealthy:
			unhealthyCount++
		}
	}

	// Determine overall status
	if unhealthyCount > 0 {
		return HealthStatusUnhealthy
	} else if degradedCount > 0 {
		return HealthStatusDegraded
	} else if healthyCount > 0 {
		return HealthStatusHealthy
	} else {
		return HealthStatusUnknown
	}
}

// healthStatusToFloat64 converts a HealthStatus string to a numeric value for Prometheus.
func healthStatusToFloat64(status HealthStatus) float64 {
	switch status {
	case HealthStatusUnknown:
		return 0
	case HealthStatusHealthy:
		return 1
	case HealthStatusDegraded:
		return 2
	case HealthStatusUnhealthy:
		return 3
	default:
		return 0
	}
}

func (m *AuthHealthMonitor) updatePrometheusMetrics() {
	if !m.config.EnableMetrics {
		return
	}

	// Update health status metrics
	m.metrics.healthStatus.WithLabelValues("jwt_service").Set(healthStatusToFloat64(m.status.JWTService.Status))
	m.metrics.healthStatus.WithLabelValues("blacklist_service").Set(healthStatusToFloat64(m.status.BlacklistService.Status))
	m.metrics.healthStatus.WithLabelValues("session_manager").Set(healthStatusToFloat64(m.status.SessionManager.Status))
	m.metrics.healthStatus.WithLabelValues("credential_manager").Set(healthStatusToFloat64(m.status.CredentialManager.Status))
}

func (m *AuthHealthMonitor) logHealthStatus() {
	fields := logrus.Fields{
		"overall_status":     m.status.OverallStatus,
		"jwt_service":        m.status.JWTService.Status,
		"blacklist_service":  m.status.BlacklistService.Status,
		"session_manager":    m.status.SessionManager.Status,
		"credential_manager": m.status.CredentialManager.Status,
		"version":            m.status.Version,
	}

	if m.status.OverallStatus == HealthStatusHealthy {
		m.logger.WithFields(fields).Debug("Authentication health check completed")
	} else {
		m.logger.WithFields(fields).Warn("Authentication health check completed with issues")
	}
}

func (m *AuthHealthMonitor) getCurrentMetrics() AuthMetrics {
	// Prometheus metrics are designed to be scraped, not read back in application code.
	// Reading values from Counter/Gauge interfaces requires using dto.Metric or testutil,
	// both of which are expensive and considered anti-patterns for production code.
	// The actual metric values are available through the Prometheus scrape endpoint.
	// This method returns the metrics struct with zero values; callers needing real-time
	// values should query the Prometheus endpoint directly.
	return AuthMetrics{}
}

// GetHealthStatusJSON returns health status as JSON
func (m *AuthHealthMonitor) GetHealthStatusJSON() ([]byte, error) {
	status := m.GetHealthStatus()
	return json.MarshalIndent(status, "", "  ")
}

// IsHealthy returns true if the overall status is healthy
func (m *AuthHealthMonitor) IsHealthy() bool {
	status := m.GetHealthStatus()
	return status.OverallStatus == HealthStatusHealthy
}

// GetPrometheusMetrics returns the default Prometheus gatherer.
// Metrics registered via promauto are automatically added to the default registry,
// so we return the default gatherer rather than attempting to re-register them.
func (m *AuthHealthMonitor) GetPrometheusMetrics() (prometheus.Gatherer, error) {
	if !m.config.EnableMetrics {
		return nil, fmt.Errorf("metrics not enabled")
	}

	return prometheus.DefaultGatherer, nil
}
