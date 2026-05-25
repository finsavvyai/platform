package fraud

import (
	"context"
	"fmt"
	"sync"
	"time"

	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.uber.org/zap"
	"golang.org/x/time/rate"
)

// ProductionService extends the fraud detection service with production-grade features
type ProductionService struct {
	*Service
	logger          *zap.Logger
	metrics         *ProductionMetrics
	rateLimiter     *rate.Limiter
	circuitBreaker  *CircuitBreaker
	healthChecker   *HealthChecker
	errorHandler    *ProductionErrorHandler
	cache           sync.Map // Simple in-memory cache for results
	config          *ProductionConfig
}

// ProductionConfig holds production-specific configuration
type ProductionConfig struct {
	MaxConcurrentRequests int
	RequestTimeout        time.Duration
	RateLimitPerSecond    int
	RateLimitBurst        int
	CircuitBreakerConfig  CircuitBreakerConfig
	CacheTTL              time.Duration
	EnableMetrics         bool
	EnableHealthChecks    bool
	EnableCircuitBreaker  bool
	EnableRateLimiting    bool
	MaxRetries            int
	RetryDelay            time.Duration
}

// ProductionMetrics holds Prometheus metrics for fraud detection
type ProductionMetrics struct {
	RequestsTotal         prometheus.Counter
	RequestDuration       prometheus.Histogram
	ErrorsTotal           prometheus.Counter
	QuantumAnalysisTotal  prometheus.Counter
	ClassicalAnalysisTotal prometheus.Counter
	QuantumLatency        prometheus.Histogram
	ClassicalLatency      prometheus.Histogram
	FraudScoreDistribution prometheus.Histogram
	CacheHits             prometheus.Counter
	CacheMisses           prometheus.Counter
	CircuitBreakerTrips   prometheus.Counter
	RateLimitExceeded     prometheus.Counter
	QuantumBackendErrors  *prometheus.CounterVec
	ConcurrentRequests    prometheus.Gauge
}

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	mu                sync.RWMutex
	state             CircuitState
	failureCount      int
	lastFailureTime   time.Time
	lastSuccessTime   time.Time
	config            CircuitBreakerConfig
	stateChangeCallbacks []func(CircuitState)
}

// CircuitBreakerConfig configures circuit breaker behavior
type CircuitBreakerConfig struct {
	MaxFailures     int
	Timeout         time.Duration
	ResetTimeout    time.Duration
	HalfOpenRetries int
}

// CircuitState represents the state of the circuit breaker
type CircuitState int

const (
	CircuitStateClosed CircuitState = iota
	CircuitStateOpen
	CircuitStateHalfOpen
)

// HealthChecker performs health checks on the service
type HealthChecker struct {
	mu            sync.RWMutex
	lastCheck     time.Time
	healthStatus  HealthStatus
	checkInterval time.Duration
}

// HealthStatus represents the health status of the service
type HealthStatus struct {
	Healthy          bool      `json:"healthy"`
	Status           string    `json:"status"`
	LastCheck        time.Time `json:"last_check"`
	QuantumAvailable bool      `json:"quantum_available"`
	DatabaseHealthy  bool      `json:"database_healthy"`
	CacheHealthy     bool      `json:"cache_healthy"`
	Errors           []string  `json:"errors,omitempty"`
	Uptime           int64     `json:"uptime_seconds"`
}

// ProductionErrorHandler handles errors with retry logic and fallback
type ProductionErrorHandler struct {
	logger      *zap.Logger
	maxRetries  int
	retryDelay  time.Duration
	fallbackFn  func(context.Context, *models.TransactionData) (*models.FraudResult, error)
}

// NewProductionService creates a new production-ready fraud detection service
func NewProductionService(
	quantumBackend interfaces.QuantumBackendService,
	router interfaces.IntelligentRouter,
	logger *zap.Logger,
	config *ProductionConfig,
) *ProductionService {
	if config == nil {
		config = DefaultProductionConfig()
	}

	baseService := NewService(quantumBackend, router)

	prodService := &ProductionService{
		Service: baseService,
		logger:  logger,
		config:  config,
	}

	// Initialize production features
	if config.EnableMetrics {
		prodService.metrics = initializeMetrics()
	}

	if config.EnableRateLimiting {
		prodService.rateLimiter = rate.NewLimiter(
			rate.Limit(config.RateLimitPerSecond),
			config.RateLimitBurst,
		)
	}

	if config.EnableCircuitBreaker {
		prodService.circuitBreaker = NewCircuitBreaker(config.CircuitBreakerConfig)
	}

	if config.EnableHealthChecks {
		prodService.healthChecker = NewHealthChecker(30 * time.Second)
		go prodService.healthChecker.StartPeriodicChecks(prodService)
	}

	prodService.errorHandler = &ProductionErrorHandler{
		logger:     logger,
		maxRetries: config.MaxRetries,
		retryDelay: config.RetryDelay,
		fallbackFn: baseService.AnalyzeTransactionClassical,
	}

	return prodService
}

// DefaultProductionConfig returns default production configuration
func DefaultProductionConfig() *ProductionConfig {
	return &ProductionConfig{
		MaxConcurrentRequests: 100,
		RequestTimeout:        30 * time.Second,
		RateLimitPerSecond:    100,
		RateLimitBurst:        200,
		CircuitBreakerConfig: CircuitBreakerConfig{
			MaxFailures:     5,
			Timeout:         60 * time.Second,
			ResetTimeout:    30 * time.Second,
			HalfOpenRetries: 3,
		},
		CacheTTL:             5 * time.Minute,
		EnableMetrics:        true,
		EnableHealthChecks:   true,
		EnableCircuitBreaker: true,
		EnableRateLimiting:   true,
		MaxRetries:           3,
		RetryDelay:           100 * time.Millisecond,
	}
}

// AnalyzeTransactionProduction performs production-grade fraud detection
func (ps *ProductionService) AnalyzeTransactionProduction(ctx context.Context, transaction *models.TransactionData) (*models.FraudResult, error) {
	startTime := time.Now()

	// Record concurrent requests
	if ps.metrics != nil {
		ps.metrics.ConcurrentRequests.Inc()
		defer ps.metrics.ConcurrentRequests.Dec()
	}

	// Check rate limit
	if ps.rateLimiter != nil && !ps.rateLimiter.Allow() {
		if ps.metrics != nil {
			ps.metrics.RateLimitExceeded.Inc()
		}
		ps.logger.Warn("Rate limit exceeded", zap.String("transaction_id", transaction.TransactionID))
		return nil, fmt.Errorf("rate limit exceeded")
	}

	// Check circuit breaker
	if ps.circuitBreaker != nil && !ps.circuitBreaker.CanExecute() {
		if ps.metrics != nil {
			ps.metrics.CircuitBreakerTrips.Inc()
		}
		ps.logger.Warn("Circuit breaker open, using fallback",
			zap.String("transaction_id", transaction.TransactionID))
		return ps.errorHandler.ExecuteWithFallback(ctx, transaction)
	}

	// Check cache
	if cachedResult := ps.checkCache(transaction.TransactionID); cachedResult != nil {
		if ps.metrics != nil {
			ps.metrics.CacheHits.Inc()
		}
		return cachedResult, nil
	}

	if ps.metrics != nil {
		ps.metrics.CacheMisses.Inc()
	}

	// Set timeout
	if ps.config.RequestTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, ps.config.RequestTimeout)
		defer cancel()
	}

	// Execute analysis with error handling
	result, err := ps.executeWithRetry(ctx, transaction)

	// Record metrics
	duration := time.Since(startTime)
	if ps.metrics != nil {
		ps.metrics.RequestsTotal.Inc()
		ps.metrics.RequestDuration.Observe(duration.Seconds())

		if err != nil {
			ps.metrics.ErrorsTotal.Inc()
			if ps.circuitBreaker != nil {
				ps.circuitBreaker.RecordFailure()
			}
		} else {
			if ps.circuitBreaker != nil {
				ps.circuitBreaker.RecordSuccess()
			}
			if result != nil {
				ps.metrics.FraudScoreDistribution.Observe(result.FraudScore)
				// Cache successful result
				ps.cacheResult(transaction.TransactionID, result)
			}
		}
	}

	// Log analysis
	ps.logger.Info("Transaction analysis completed",
		zap.String("transaction_id", transaction.TransactionID),
		zap.Duration("duration", duration),
		zap.Bool("error", err != nil),
		zap.Float64("fraud_score", func() float64 {
			if result != nil {
				return result.FraudScore
			}
			return 0
		}()),
	)

	return result, err
}

// executeWithRetry executes the analysis with retry logic
func (ps *ProductionService) executeWithRetry(ctx context.Context, transaction *models.TransactionData) (*models.FraudResult, error) {
	var lastErr error

	for attempt := 0; attempt < ps.config.MaxRetries; attempt++ {
		if attempt > 0 {
			ps.logger.Info("Retrying analysis",
				zap.String("transaction_id", transaction.TransactionID),
				zap.Int("attempt", attempt+1))

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(ps.config.RetryDelay * time.Duration(attempt+1)):
				// Exponential backoff
			}
		}

		result, err := ps.Service.AnalyzeTransactionQuantum(ctx, transaction)
		if err == nil {
			if ps.metrics != nil && result != nil {
				ps.metrics.QuantumAnalysisTotal.Inc()
			}
			return result, nil
		}

		lastErr = err
		ps.logger.Warn("Analysis attempt failed",
			zap.String("transaction_id", transaction.TransactionID),
			zap.Int("attempt", attempt+1),
			zap.Error(err))
	}

	// All retries failed, use fallback
	ps.logger.Warn("All retries exhausted, using classical fallback",
		zap.String("transaction_id", transaction.TransactionID))

	return ps.errorHandler.ExecuteWithFallback(ctx, transaction)
}

// checkCache checks if a result is cached
func (ps *ProductionService) checkCache(transactionID string) *models.FraudResult {
	if value, ok := ps.cache.Load(transactionID); ok {
		if cached, ok := value.(*cachedResult); ok {
			if time.Since(cached.timestamp) < ps.config.CacheTTL {
				return cached.result
			}
			// Cache expired
			ps.cache.Delete(transactionID)
		}
	}
	return nil
}

// cacheResult caches a fraud result
func (ps *ProductionService) cacheResult(transactionID string, result *models.FraudResult) {
	ps.cache.Store(transactionID, &cachedResult{
		result:    result,
		timestamp: time.Now(),
	})

	// Start goroutine to cleanup expired cache after TTL
	go func() {
		time.Sleep(ps.config.CacheTTL)
		ps.cache.Delete(transactionID)
	}()
}

// cachedResult wraps a result with timestamp
type cachedResult struct {
	result    *models.FraudResult
	timestamp time.Time
}

// GetHealth returns the current health status
func (ps *ProductionService) GetHealth(ctx context.Context) (*HealthStatus, error) {
	if ps.healthChecker != nil {
		return ps.healthChecker.GetStatus(), nil
	}

	// Basic health check if health checker not enabled
	return &HealthStatus{
		Healthy:   true,
		Status:    "ok",
		LastCheck: time.Now(),
	}, nil
}

// ExecuteWithFallback executes with classical fallback on error
func (eh *ProductionErrorHandler) ExecuteWithFallback(ctx context.Context, transaction *models.TransactionData) (*models.FraudResult, error) {
	if eh.fallbackFn == nil {
		return nil, fmt.Errorf("no fallback function available")
	}

	eh.logger.Info("Executing classical fallback",
		zap.String("transaction_id", transaction.TransactionID))

	classicalResult, err := eh.fallbackFn(ctx, transaction)
	if err != nil {
		eh.logger.Error("Classical fallback also failed",
			zap.String("transaction_id", transaction.TransactionID),
			zap.Error(err))
		return nil, fmt.Errorf("both quantum and classical analysis failed: %w", err)
	}

	// Convert classical result to FraudResult
	result := &models.FraudResult{
		TransactionID:    classicalResult.TransactionID,
		FraudScore:       classicalResult.FraudScore,
		ProcessingMethod: models.ProcessingMethodClassical,
		Confidence:       classicalResult.Confidence,
		ProcessingTimeMs: classicalResult.ProcessingTimeMs,
		ModelVersion:     classicalResult.ModelVersion,
		Explanation:      classicalResult.Explanation,
	}
	result.RiskLevel = result.CalculateRiskLevel()

	return result, nil
}

// Circuit Breaker Implementation

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		state:  CircuitStateClosed,
		config: config,
	}
}

// CanExecute checks if the circuit allows execution
func (cb *CircuitBreaker) CanExecute() bool {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	switch cb.state {
	case CircuitStateClosed:
		return true
	case CircuitStateOpen:
		// Check if timeout has passed
		if time.Since(cb.lastFailureTime) > cb.config.Timeout {
			cb.mu.RUnlock()
			cb.mu.Lock()
			cb.setState(CircuitStateHalfOpen)
			cb.mu.Unlock()
			cb.mu.RLock()
			return true
		}
		return false
	case CircuitStateHalfOpen:
		return true
	}
	return false
}

// RecordSuccess records a successful execution
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.lastSuccessTime = time.Now()
	cb.failureCount = 0

	if cb.state == CircuitStateHalfOpen {
		cb.setState(CircuitStateClosed)
	}
}

// RecordFailure records a failed execution
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.lastFailureTime = time.Now()
	cb.failureCount++

	if cb.state == CircuitStateHalfOpen || cb.failureCount >= cb.config.MaxFailures {
		cb.setState(CircuitStateOpen)
	}
}

// setState changes the circuit state
func (cb *CircuitBreaker) setState(newState CircuitState) {
	if cb.state != newState {
		cb.state = newState
		for _, callback := range cb.stateChangeCallbacks {
			go callback(newState)
		}
	}
}

// GetState returns the current circuit state
func (cb *CircuitBreaker) GetState() CircuitState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Health Checker Implementation

// NewHealthChecker creates a new health checker
func NewHealthChecker(interval time.Duration) *HealthChecker {
	return &HealthChecker{
		checkInterval: interval,
		healthStatus: HealthStatus{
			Healthy:   true,
			Status:    "initializing",
			LastCheck: time.Now(),
		},
	}
}

// StartPeriodicChecks starts periodic health checks
func (hc *HealthChecker) StartPeriodicChecks(service *ProductionService) {
	ticker := time.NewTicker(hc.checkInterval)
	defer ticker.Stop()

	for range ticker.C {
		hc.performHealthCheck(service)
	}
}

// performHealthCheck performs a health check
func (hc *HealthChecker) performHealthCheck(service *ProductionService) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	status := HealthStatus{
		Healthy:   true,
		Status:    "healthy",
		LastCheck: time.Now(),
		Errors:    []string{},
	}

	// Check quantum backend availability
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if hardwareStatus, err := service.Service.quantumBackend.MonitorQuantumHardware(ctx); err == nil {
		status.QuantumAvailable = hardwareStatus.AvailableBackends > 0
		if !status.QuantumAvailable {
			status.Healthy = false
			status.Errors = append(status.Errors, "no quantum backends available")
		}
	} else {
		status.QuantumAvailable = false
		status.Healthy = false
		status.Errors = append(status.Errors, fmt.Sprintf("quantum backend check failed: %v", err))
	}

	// Additional health checks can be added here
	status.DatabaseHealthy = true // Placeholder
	status.CacheHealthy = true    // Placeholder

	if status.Healthy {
		status.Status = "healthy"
	} else {
		status.Status = "unhealthy"
	}

	hc.healthStatus = status
}

// GetStatus returns the current health status
func (hc *HealthChecker) GetStatus() *HealthStatus {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	statusCopy := hc.healthStatus
	return &statusCopy
}

// Metrics initialization

func initializeMetrics() *ProductionMetrics {
	return &ProductionMetrics{
		RequestsTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "fraud_detection_requests_total",
			Help: "Total number of fraud detection requests",
		}),
		RequestDuration: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "fraud_detection_request_duration_seconds",
			Help:    "Duration of fraud detection requests",
			Buckets: prometheus.DefBuckets,
		}),
		ErrorsTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "fraud_detection_errors_total",
			Help: "Total number of fraud detection errors",
		}),
		QuantumAnalysisTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "fraud_detection_quantum_analysis_total",
			Help: "Total number of quantum analyses",
		}),
		ClassicalAnalysisTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "fraud_detection_classical_analysis_total",
			Help: "Total number of classical analyses",
		}),
		QuantumLatency: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "fraud_detection_quantum_latency_seconds",
			Help:    "Latency of quantum fraud detection",
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
		}),
		ClassicalLatency: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "fraud_detection_classical_latency_seconds",
			Help:    "Latency of classical fraud detection",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
		}),
		FraudScoreDistribution: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "fraud_detection_score_distribution",
			Help:    "Distribution of fraud scores",
			Buckets: []float64{0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		}),
		CacheHits: promauto.NewCounter(prometheus.CounterOpts{
			Name: "fraud_detection_cache_hits_total",
			Help: "Total number of cache hits",
		}),
		CacheMisses: promauto.NewCounter(prometheus.CounterOpts{
			Name: "fraud_detection_cache_misses_total",
			Help: "Total number of cache misses",
		}),
		CircuitBreakerTrips: promauto.NewCounter(prometheus.CounterOpts{
			Name: "fraud_detection_circuit_breaker_trips_total",
			Help: "Total number of circuit breaker trips",
		}),
		RateLimitExceeded: promauto.NewCounter(prometheus.CounterOpts{
			Name: "fraud_detection_rate_limit_exceeded_total",
			Help: "Total number of rate limit exceeded events",
		}),
		QuantumBackendErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_quantum_backend_errors_total",
				Help: "Total number of quantum backend errors by backend",
			},
			[]string{"backend"},
		),
		ConcurrentRequests: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "fraud_detection_concurrent_requests",
			Help: "Number of concurrent fraud detection requests",
		}),
	}
}

// String returns a string representation of the circuit state
func (cs CircuitState) String() string {
	switch cs {
	case CircuitStateClosed:
		return "closed"
	case CircuitStateOpen:
		return "open"
	case CircuitStateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}
