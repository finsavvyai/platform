package circuitbreaker

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// State represents the state of a circuit breaker
type State int

const (
	// StateClosed means the circuit breaker is closed and requests pass through
	StateClosed State = iota
	// StateOpen means the circuit breaker is open and requests fail fast
	StateOpen
	// StateHalfOpen means the circuit breaker is half-open and testing if service has recovered
	StateHalfOpen
)

// String returns the string representation of the state
func (s State) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF_OPEN"
	default:
		return "UNKNOWN"
	}
}

var (
	// ErrCircuitBreakerOpen is returned when the circuit breaker is open
	ErrCircuitBreakerOpen = errors.New("circuit breaker is open")
	// ErrServiceUnavailable is returned when the service is unavailable
	ErrServiceUnavailable = errors.New("service unavailable")
)

// Config holds the configuration for a circuit breaker
type Config struct {
	// MaxFailures is the number of failures before opening the circuit
	MaxFailures int `json:"max_failures"`
	// ResetTimeout is the duration to wait before transitioning from OPEN to HALF_OPEN
	ResetTimeout time.Duration `json:"reset_timeout"`
	// SuccessThreshold is the number of successful requests in HALF_OPEN before closing
	SuccessThreshold int `json:"success_threshold"`
	// FailureThreshold is the number of failures in HALF_OPEN before opening again
	FailureThreshold int `json:"failure_threshold"`
	// RequestTimeout is the timeout for individual requests
	RequestTimeout time.Duration `json:"request_timeout"`
	// MonitorInterval is the interval for monitoring and logging circuit breaker state
	MonitorInterval time.Duration `json:"monitor_interval"`
	// Name is the name of the circuit breaker (for logging/metrics)
	Name string `json:"name"`
}

// DefaultConfig returns a default circuit breaker configuration
func DefaultConfig() Config {
	return Config{
		MaxFailures:      5,
		ResetTimeout:     30 * time.Second,
		SuccessThreshold: 3,
		FailureThreshold: 2,
		RequestTimeout:   10 * time.Second,
		MonitorInterval:  1 * time.Minute,
		Name:             "default",
	}
}

// Metrics holds the circuit breaker metrics
type Metrics struct {
	TotalRequests      uint64        `json:"total_requests"`
	SuccessfulRequests uint64        `json:"successful_requests"`
	FailedRequests     uint64        `json:"failed_requests"`
	TimeoutRequests    uint64        `json:"timeout_requests"`
	LastFailureTime    time.Time     `json:"last_failure_time"`
	LastSuccessTime    time.Time     `json:"last_success_time"`
	CurrentState       State         `json:"current_state"`
	StateChanges       uint64        `json:"state_changes"`
	Uptime             time.Duration `json:"uptime"`
}

// CircuitBreaker is the main circuit breaker implementation
type CircuitBreaker struct {
	config      Config
	state       State
	failures    int
	successes   int
	lastFailure time.Time
	lastSuccess time.Time
	mutex       sync.RWMutex
	metrics     Metrics
	startTime   time.Time
	logger      *logrus.Entry
	tracer      trace.Tracer
	// Event callbacks
	onStateChange func(oldState, newState State)
	onRequest     func(success bool, duration time.Duration)
}

// New creates a new circuit breaker with the given configuration
func New(config Config) *CircuitBreaker {
	if config.Name == "" {
		config.Name = "default"
	}

	cb := &CircuitBreaker{
		config:    config,
		state:     StateClosed,
		startTime: time.Now(),
		logger: logrus.WithFields(logrus.Fields{
			"circuit_breaker": config.Name,
			"component":       "circuit_breaker",
		}),
		tracer: otel.Tracer("circuit-breaker"),
	}

	// Start monitoring goroutine
	go cb.monitor()

	return cb
}

// Execute executes a function through the circuit breaker
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func(context.Context) error) error {
	ctx, span := cb.tracer.Start(ctx, fmt.Sprintf("circuit_breaker.execute.%s", cb.config.Name),
		trace.WithAttributes(
			attribute.String("circuit_breaker.name", cb.config.Name),
			attribute.String("circuit_breaker.state", cb.state.String()),
		))
	defer span.End()

	start := time.Now()

	// Check if we can execute the request
	if !cb.canExecute() {
		cb.recordMetrics(false, time.Since(start))
		return ErrCircuitBreakerOpen
	}

	// Add timeout to context if configured
	if cb.config.RequestTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, cb.config.RequestTimeout)
		defer cancel()
	}

	// Execute the function
	err := fn(ctx)
	duration := time.Since(start)

	// Record the result
	cb.recordResult(err, duration)

	return err
}

// ExecuteWithResult executes a function that returns a result through the circuit breaker
func (cb *CircuitBreaker) ExecuteWithResult(ctx context.Context, fn func(context.Context) (interface{}, error)) (interface{}, error) {
	var result interface{}
	err := cb.Execute(ctx, func(ctx context.Context) error {
		var execErr error
		result, execErr = fn(ctx)
		return execErr
	})

	return result, err
}

// State returns the current state of the circuit breaker
func (cb *CircuitBreaker) State() State {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()
	return cb.state
}

// Metrics returns the current metrics of the circuit breaker
func (cb *CircuitBreaker) Metrics() Metrics {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()
	metrics := cb.metrics
	metrics.CurrentState = cb.state
	metrics.Uptime = time.Since(cb.startTime)
	return metrics
}

// Reset resets the circuit breaker to its initial state
func (cb *CircuitBreaker) Reset() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	cb.state = StateClosed
	cb.failures = 0
	cb.successes = 0
	cb.lastFailure = time.Time{}
	cb.lastSuccess = time.Time{}
	cb.metrics = Metrics{}

	cb.logger.Info("Circuit breaker reset")
}

// SetStateChangeCallback sets a callback to be called when the state changes
func (cb *CircuitBreaker) SetStateChangeCallback(callback func(oldState, newState State)) {
	cb.onStateChange = callback
}

// SetRequestCallback sets a callback to be called for each request
func (cb *CircuitBreaker) SetRequestCallback(callback func(success bool, duration time.Duration)) {
	cb.onRequest = callback
}

// canExecute checks if we can execute a request based on the current state
func (cb *CircuitBreaker) canExecute() bool {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()

	switch cb.state {
	case StateClosed:
		return true
	case StateOpen:
		// Check if we should transition to HALF_OPEN
		return time.Since(cb.lastFailure) >= cb.config.ResetTimeout
	case StateHalfOpen:
		return true
	default:
		return false
	}
}

// recordResult records the result of a request and updates state accordingly
func (cb *CircuitBreaker) recordResult(err error, duration time.Duration) {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	cb.recordMetrics(err == nil, duration)

	if err != nil {
		cb.handleFailure()
	} else {
		cb.handleSuccess()
	}
}

// handleFailure handles a failed request
func (cb *CircuitBreaker) handleFailure() {
	cb.lastFailure = time.Now()
	cb.failures++

	switch cb.state {
	case StateClosed:
		if cb.failures >= cb.config.MaxFailures {
			cb.setState(StateOpen)
		}
	case StateHalfOpen:
		if cb.failures >= cb.config.FailureThreshold {
			cb.setState(StateOpen)
		}
	case StateOpen:
		// Already open, nothing to do
	}
}

// handleSuccess handles a successful request
func (cb *CircuitBreaker) handleSuccess() {
	cb.lastSuccess = time.Now()
	cb.successes++

	switch cb.state {
	case StateOpen, StateHalfOpen:
		if cb.successes >= cb.config.SuccessThreshold {
			cb.setState(StateClosed)
			cb.failures = 0
			cb.successes = 0
		}
	case StateClosed:
		// Reset failure count on success
		cb.failures = 0
	}
}

// setState changes the state of the circuit breaker
func (cb *CircuitBreaker) setState(newState State) {
	oldState := cb.state
	cb.state = newState
	cb.metrics.StateChanges++

	cb.logger.WithFields(logrus.Fields{
		"old_state": oldState.String(),
		"new_state": newState.String(),
		"failures":  cb.failures,
		"successes": cb.successes,
	}).Info("Circuit breaker state changed")

	// Call state change callback if set
	if cb.onStateChange != nil {
		go cb.onStateChange(oldState, newState)
	}
}

// recordMetrics records metrics for a request
func (cb *CircuitBreaker) recordMetrics(success bool, duration time.Duration) {
	cb.metrics.TotalRequests++
	if success {
		cb.metrics.SuccessfulRequests++
	} else {
		cb.metrics.FailedRequests++
	}

	// Call request callback if set
	if cb.onRequest != nil {
		go cb.onRequest(success, duration)
	}
}

// monitor runs periodic monitoring and logging
func (cb *CircuitBreaker) monitor() {
	ticker := time.NewTicker(cb.config.MonitorInterval)
	defer ticker.Stop()

	for range ticker.C {
		cb.logStatus()
	}
}

// logStatus logs the current status of the circuit breaker
func (cb *CircuitBreaker) logStatus() {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()

	metrics := cb.metrics
	metrics.CurrentState = cb.state
	metrics.Uptime = time.Since(cb.startTime)

	successRate := float64(0)
	if metrics.TotalRequests > 0 {
		successRate = float64(metrics.SuccessfulRequests) / float64(metrics.TotalRequests) * 100
	}

	cb.logger.WithFields(logrus.Fields{
		"state":                cb.state.String(),
		"total_requests":       metrics.TotalRequests,
		"successful_requests":  metrics.SuccessfulRequests,
		"failed_requests":      metrics.FailedRequests,
		"success_rate_percent": fmt.Sprintf("%.2f", successRate),
		"current_failures":     cb.failures,
		"current_successes":    cb.successes,
		"last_failure_time":    metrics.LastFailureTime,
		"last_success_time":    metrics.LastSuccessTime,
		"uptime":               metrics.Uptime.String(),
		"state_changes":        metrics.StateChanges,
	}).Debug("Circuit breaker status")
}

// Registry manages multiple circuit breakers
type Registry struct {
	breakers map[string]*CircuitBreaker
	mutex    sync.RWMutex
	logger   *logrus.Entry
}

// NewRegistry creates a new circuit breaker registry
func NewRegistry() *Registry {
	return &Registry{
		breakers: make(map[string]*CircuitBreaker),
		logger: logrus.WithFields(logrus.Fields{
			"component": "circuit_breaker_registry",
		}),
	}
}

// GetOrCreate gets a circuit breaker by name or creates a new one
func (r *Registry) GetOrCreate(name string, config Config) *CircuitBreaker {
	r.mutex.RLock()
	cb, exists := r.breakers[name]
	r.mutex.RUnlock()

	if exists {
		return cb
	}

	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Double-check after acquiring write lock
	if cb, exists := r.breakers[name]; exists {
		return cb
	}

	// Create new circuit breaker
	config.Name = name
	cb = New(config)
	r.breakers[name] = cb

	r.logger.WithField("name", name).Info("Created new circuit breaker")

	return cb
}

// Get gets a circuit breaker by name
func (r *Registry) Get(name string) (*CircuitBreaker, bool) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	cb, exists := r.breakers[name]
	return cb, exists
}

// List returns all circuit breaker names
func (r *Registry) List() []string {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	names := make([]string, 0, len(r.breakers))
	for name := range r.breakers {
		names = append(names, name)
	}
	return names
}

// GetAllMetrics returns metrics for all circuit breakers
func (r *Registry) GetAllMetrics() map[string]Metrics {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	metrics := make(map[string]Metrics)
	for name, cb := range r.breakers {
		metrics[name] = cb.Metrics()
	}
	return metrics
}

// Shutdown shuts down all circuit breakers
func (r *Registry) Shutdown() {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	for name, cb := range r.breakers {
		cb.logger.WithField("name", name).Info("Shutting down circuit breaker")
	}
	r.breakers = make(map[string]*CircuitBreaker)
}

// Global registry instance
var globalRegistry = NewRegistry()

// GetGlobalRegistry returns the global circuit breaker registry
func GetGlobalRegistry() *Registry {
	return globalRegistry
}

// convenience functions using the global registry

// Execute executes a function through a circuit breaker using the global registry
func Execute(ctx context.Context, name string, fn func(context.Context) error) error {
	config := DefaultConfig()
	cb := GetGlobalRegistry().GetOrCreate(name, config)
	return cb.Execute(ctx, fn)
}

// ExecuteWithConfig executes a function through a circuit breaker with custom configuration
func ExecuteWithConfig(ctx context.Context, name string, config Config, fn func(context.Context) error) error {
	cb := GetGlobalRegistry().GetOrCreate(name, config)
	return cb.Execute(ctx, fn)
}

// ExecuteWithResult executes a function that returns a result through a circuit breaker
func ExecuteWithResult(ctx context.Context, name string, fn func(context.Context) (interface{}, error)) (interface{}, error) {
	config := DefaultConfig()
	cb := GetGlobalRegistry().GetOrCreate(name, config)
	return cb.ExecuteWithResult(ctx, fn)
}
