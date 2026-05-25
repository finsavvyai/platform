package retry

import (
	"context"
	"fmt"
	"time"
)

// ========================================
// Retry Mechanism
// ========================================

// Retrier provides retry functionality with configurable strategies
type Retrier struct {
	options Options
	attempt int
}

// NewRetrier creates a new retrier with the given options
func NewRetrier(options ...Option) *Retrier {
	opts := DefaultOptions()
	for _, option := range options {
		option(&opts)
	}

	return &Retrier{
		options: opts,
		attempt: 0,
	}
}

// Do executes a function with retry logic
func (r *Retrier) Do(fn func() error) error {
	return r.DoWithContext(r.options.Context, func(ctx context.Context) error {
		return fn()
	})
}

// DoWithContext executes a function with retry logic and context
func (r *Retrier) DoWithContext(ctx context.Context, fn func(context.Context) error) error {
	var lastErr error

	for r.attempt = 0; r.attempt < r.options.MaxAttempts; r.attempt++ {
		// Check context
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Execute the function
		err := fn(ctx)
		if err == nil {
			return nil // Success
		}

		lastErr = err

		// Check if we should retry this error
		if r.options.RetryCondition != nil && !r.options.RetryCondition(err) {
			break // Don't retry this error
		}

		// Call retry callback if provided
		if r.options.OnRetry != nil {
			r.options.OnRetry(r.attempt+1, err)
		}

		// If this was the last attempt, don't wait
		if r.attempt >= r.options.MaxAttempts-1 {
			break
		}

		// Calculate delay and wait
		delay := r.options.Backoff.NextDelay(r.attempt+1, err)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
			// Continue to next attempt
		}
	}

	// Reset attempt counter for next use
	r.attempt = 0

	// Return the last error
	return fmt.Errorf("retry failed after %d attempts: %w", r.options.MaxAttempts, lastErr)
}

// DoWithResult executes a function that returns a result with retry logic
func (r *Retrier) DoWithResult(fn func() (interface{}, error)) (interface{}, error) {
	return r.DoWithResultWithContext(r.options.Context, func(ctx context.Context) (interface{}, error) {
		return fn()
	})
}

// DoWithResultWithContext executes a function that returns a result with retry logic and context
func (r *Retrier) DoWithResultWithContext(ctx context.Context, fn func(context.Context) (interface{}, error)) (interface{}, error) {
	var result interface{}

	err := r.DoWithContext(ctx, func(ctx context.Context) error {
		res, err := fn(ctx)
		if err == nil {
			result = res
		}
		return err
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}

// Reset resets the retry state
func (r *Retrier) Reset() {
	r.attempt = 0
	r.options.Backoff.Reset()
}

// Attempts returns the current attempt count
func (r *Retrier) Attempts() int {
	return r.attempt
}

// MaxAttempts returns the maximum number of attempts
func (r *Retrier) MaxAttempts() int {
	return r.options.MaxAttempts
}

// ========================================
// Convenience Functions
// ========================================

// Retry executes a function with standard retry options
func Retry(fn func() error, options ...Option) error {
	retrier := NewRetrier(options...)
	return retrier.Do(fn)
}

// RetryWithContext executes a function with retry options and context
func RetryWithContext(ctx context.Context, fn func(context.Context) error, options ...Option) error {
	retrier := NewRetrier(append(options, WithContext(ctx))...)
	return retrier.DoWithContext(ctx, fn)
}

// RetryWithResult executes a function that returns a result
func RetryWithResult(fn func() (interface{}, error), options ...Option) (interface{}, error) {
	retrier := NewRetrier(options...)
	return retrier.DoWithResult(fn)
}

// RetryWithResultWithContext executes a function that returns a result with context
func RetryWithResultWithContext(ctx context.Context, fn func(context.Context) (interface{}, error), options ...Option) (interface{}, error) {
	retrier := NewRetrier(append(options, WithContext(ctx))...)
	return retrier.DoWithResultWithContext(ctx, fn)
}

// ========================================
// Specialized Retry Functions
// ========================================

// RetryNetwork retries on network errors
func RetryNetwork(fn func() error, maxAttempts int) error {
	return Retry(fn,
		WithMaxAttempts(maxAttempts),
		WithRetryCondition(NetworkError),
		WithBackoff(StandardRetry),
	)
}

// RetryServer retries on server errors
func RetryServer(fn func() error, maxAttempts int) error {
	return Retry(fn,
		WithMaxAttempts(maxAttempts),
		WithRetryCondition(ServerError),
		WithBackoff(StandardRetry),
	)
}

// RetryRateLimit retries on rate limit errors
func RetryRateLimit(fn func() error, maxAttempts int) error {
	return Retry(fn,
		WithMaxAttempts(maxAttempts),
		WithRetryCondition(RateLimitError),
		WithBackoff(SlowRetry), // Use slower backoff for rate limits
	)
}

// RetryFast retries with minimal delays
func RetryFast(fn func() error, maxAttempts int) error {
	return Retry(fn,
		WithMaxAttempts(maxAttempts),
		WithBackoff(FastRetry),
	)
}

// ========================================
// Async Retry
// ========================================

// AsyncRetry executes a function asynchronously with retry logic
func AsyncRetry(fn func() error, options ...Option) <-chan error {
	ch := make(chan error, 1)

	go func() {
		defer close(ch)
		ch <- Retry(fn, options...)
	}()

	return ch
}

// AsyncRetryWithContext executes a function asynchronously with retry logic and context
func AsyncRetryWithContext(ctx context.Context, fn func(context.Context) error, options ...Option) <-chan error {
	ch := make(chan error, 1)

	go func() {
		defer close(ch)
		ch <- RetryWithContext(ctx, fn, options...)
	}()

	return ch
}

// ========================================
// Batch Retry
// ========================================

// BatchRetry executes multiple functions with retry logic
type BatchRetry struct {
	functions []func() error
	options   Options
}

// NewBatchRetry creates a new batch retry
func NewBatchRetry(functions []func() error, options ...Option) *BatchRetry {
	return &BatchRetry{
		functions: functions,
		options:   DefaultOptions(),
	}
}

// Execute executes all functions with retry logic
func (br *BatchRetry) Execute() []error {
	results := make([]error, len(br.functions))

	for i, fn := range br.functions {
		results[i] = Retry(fn,
			WithMaxAttempts(br.options.MaxAttempts),
			WithBackoff(br.options.Backoff),
			WithRetryCondition(br.options.RetryCondition),
			WithOnRetry(br.options.OnRetry),
			WithContext(br.options.Context),
		)
	}

	return results
}

// ExecuteParallel executes all functions in parallel with retry logic
func (br *BatchRetry) ExecuteParallel() []error {
	results := make([]error, len(br.functions))
	ch := make(chan struct {
		index int
		err   error
	}, len(br.functions))

	for i, fn := range br.functions {
		go func(index int, f func() error) {
			err := Retry(f,
				WithMaxAttempts(br.options.MaxAttempts),
				WithBackoff(br.options.Backoff),
				WithRetryCondition(br.options.RetryCondition),
				WithOnRetry(br.options.OnRetry),
				WithContext(br.options.Context),
			)
			ch <- struct {
				index int
				err   error
			}{index, err}
		}(i, fn)
	}

	for i := 0; i < len(br.functions); i++ {
		result := <-ch
		results[result.index] = result.err
	}

	return results
}

// ========================================
// Circuit Breaker Integration
// ========================================

// CircuitBreakerRetrier combines retry logic with circuit breaker
type CircuitBreakerRetrier struct {
	retrier        *Retrier
	circuitBreaker CircuitBreaker
	breakerTimeout time.Duration
}

// CircuitBreaker interface
type CircuitBreaker interface {
	Execute(fn func() error) error
	IsOpen() bool
	IsHalfOpen() bool
	IsClosed() bool
	Reset()
}

// NewCircuitBreakerRetrier creates a new circuit breaker retrier
func NewCircuitBreakerRetrier(cb CircuitBreaker, timeout time.Duration, options ...Option) *CircuitBreakerRetrier {
	return &CircuitBreakerRetrier{
		retrier:        NewRetrier(options...),
		circuitBreaker: cb,
		breakerTimeout: timeout,
	}
}

// Do executes a function with both retry and circuit breaker logic
func (cbr *CircuitBreakerRetrier) Do(fn func() error) error {
	// Check if circuit breaker is open
	if cbr.circuitBreaker.IsOpen() {
		return fmt.Errorf("circuit breaker is open")
	}

	// Execute with retry through circuit breaker
	err := cbr.circuitBreaker.Execute(func() error {
		return cbr.retrier.Do(fn)
	})

	// If circuit breaker is open after execution, wait for timeout
	if err != nil && cbr.circuitBreaker.IsOpen() {
		select {
		case <-time.After(cbr.breakerTimeout):
			// Try to reset the circuit breaker
			cbr.circuitBreaker.Reset()
		case <-cbr.retrier.options.Context.Done():
			return cbr.retrier.options.Context.Err()
		}
	}

	return err
}

// ========================================
// Metrics and Monitoring
// ========================================

// RetryMetrics tracks retry statistics
type RetryMetrics struct {
	TotalAttempts     int64
	SuccessfulRetries int64
	FailedRetries     int64
	TotalDuration     time.Duration
	MaxRetryTime      time.Duration
	AvgRetryTime      time.Duration
}

// MetricsRetrier tracks retry metrics
type MetricsRetrier struct {
	retrier *Retrier
	metrics RetryMetrics
}

// NewMetricsRetrier creates a new metrics retrier
func NewMetricsRetrier(options ...Option) *MetricsRetrier {
	retrier := NewRetrier(options...)

	// Add retry callback to track metrics
	options = append(options, WithOnRetry(func(attempt int, err error) {
		// This would be called on each retry attempt
	}))

	return &MetricsRetrier{
		retrier: retrier,
	}
}

// Do executes a function with retry logic and tracks metrics
func (mr *MetricsRetrier) Do(fn func() error) error {
	start := time.Now()
	err := mr.retrier.Do(fn)
	duration := time.Since(start)

	// Update metrics
	mr.metrics.TotalAttempts++
	mr.metrics.TotalDuration += duration

	if duration > mr.metrics.MaxRetryTime {
		mr.metrics.MaxRetryTime = duration
	}

	mr.metrics.AvgRetryTime = mr.metrics.TotalDuration / time.Duration(mr.metrics.TotalAttempts)

	if err == nil {
		mr.metrics.SuccessfulRetries++
	} else {
		mr.metrics.FailedRetries++
	}

	return err
}

// GetMetrics returns the current metrics
func (mr *MetricsRetrier) GetMetrics() RetryMetrics {
	return mr.metrics
}

// ResetMetrics resets all metrics
func (mr *MetricsRetrier) ResetMetrics() {
	mr.metrics = RetryMetrics{}
}

// ========================================
// Retry Error Types
// ========================================

// RetryError wraps errors with retry information
type RetryError struct {
	Attempt     int
	MaxAttempts int
	LastError   error
	TotalTime   time.Duration
}

// Error implements the error interface
func (re *RetryError) Error() string {
	return fmt.Sprintf("retry failed after %d/%d attempts (last error: %v, total time: %v)",
		re.Attempt, re.MaxAttempts, re.LastError, re.TotalTime)
}

// Unwrap returns the wrapped error
func (re *RetryError) Unwrap() error {
	return re.LastError
}

// IsTimeout checks if the error is a timeout
func (re *RetryError) IsTimeout() bool {
	// Check if the last error is a timeout
	if err, ok := re.LastError.(interface{ IsTimeout() bool }); ok {
		return err.IsTimeout()
	}
	return false
}

// IsRetryable checks if the error is retryable
func (re *RetryError) IsRetryable() bool {
	// This error indicates retries were attempted and failed
	return re.Attempt < re.MaxAttempts
}
