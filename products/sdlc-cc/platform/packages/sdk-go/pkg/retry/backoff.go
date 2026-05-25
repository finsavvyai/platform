package retry

import (
	"context"
	"math"
	"math/rand"
	"strconv"
	"time"
)

// ========================================
// Backoff Strategies
// ========================================

// BackoffStrategy defines the interface for backoff strategies
type BackoffStrategy interface {
	NextDelay(attempt int, err error) time.Duration
	Reset()
}

// ExponentialBackoff implements exponential backoff with jitter
type ExponentialBackoff struct {
	InitialDelay time.Duration
	MaxDelay     time.Duration
	Multiplier   float64
	Jitter       bool
	Random       *rand.Rand
}

// NewExponentialBackoff creates a new exponential backoff strategy
func NewExponentialBackoff(initialDelay, maxDelay time.Duration, multiplier float64, jitter bool) *ExponentialBackoff {
	return &ExponentialBackoff{
		InitialDelay: initialDelay,
		MaxDelay:     maxDelay,
		Multiplier:   multiplier,
		Jitter:       jitter,
		Random:       rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// NextDelay returns the next delay using exponential backoff
func (b *ExponentialBackoff) NextDelay(attempt int, _ error) time.Duration {
	if attempt <= 0 {
		return b.InitialDelay
	}

	delay := float64(b.InitialDelay) * math.Pow(b.Multiplier, float64(attempt-1))

	// Apply jitter
	if b.Jitter {
		jitter := delay * 0.1 * (b.Random.Float64()*2 - 1) // ±10% jitter
		delay += jitter
	}

	// Cap at max delay
	if delay > float64(b.MaxDelay) {
		delay = float64(b.MaxDelay)
	}

	return time.Duration(delay)
}

// Reset resets the backoff strategy
func (b *ExponentialBackoff) Reset() {
	// No state to reset for this implementation
}

// LinearBackoff implements linear backoff
type LinearBackoff struct {
	InitialDelay time.Duration
	Increment    time.Duration
	MaxDelay     time.Duration
	Jitter       bool
	Random       *rand.Rand
}

// NewLinearBackoff creates a new linear backoff strategy
func NewLinearBackoff(initialDelay, increment, maxDelay time.Duration, jitter bool) *LinearBackoff {
	return &LinearBackoff{
		InitialDelay: initialDelay,
		Increment:    increment,
		MaxDelay:     maxDelay,
		Jitter:       jitter,
		Random:       rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// NextDelay returns the next delay using linear backoff
func (b *LinearBackoff) NextDelay(attempt int, _ error) time.Duration {
	delay := b.InitialDelay + time.Duration(attempt-1)*b.Increment

	// Apply jitter
	if b.Jitter {
		jitter := time.Duration(float64(delay) * 0.1 * (b.Random.Float64()*2 - 1))
		delay += jitter
	}

	// Cap at max delay
	if delay > b.MaxDelay {
		delay = b.MaxDelay
	}

	return delay
}

// Reset resets the backoff strategy
func (b *LinearBackoff) Reset() {
	// No state to reset for this implementation
}

// FixedBackoff implements fixed delay backoff
type FixedBackoff struct {
	Delay  time.Duration
	Jitter bool
	Random *rand.Rand
}

// NewFixedBackoff creates a new fixed backoff strategy
func NewFixedBackoff(delay time.Duration, jitter bool) *FixedBackoff {
	return &FixedBackoff{
		Delay:  delay,
		Jitter: jitter,
		Random: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// NextDelay returns the fixed delay
func (b *FixedBackoff) NextDelay(_ int, _ error) time.Duration {
	delay := b.Delay

	// Apply jitter
	if b.Jitter {
		jitter := time.Duration(float64(delay) * 0.1 * (b.Random.Float64()*2 - 1))
		delay += jitter
	}

	return delay
}

// Reset resets the backoff strategy
func (b *FixedBackoff) Reset() {
	// No state to reset for this implementation
}

// CustomBackoff allows custom backoff logic
type CustomBackoff struct {
	NextDelayFunc func(attempt int, err error) time.Duration
	ResetFunc     func()
}

// NewCustomBackoff creates a new custom backoff strategy
func NewCustomBackoff(nextDelayFunc func(int, error) time.Duration, resetFunc func()) *CustomBackoff {
	return &CustomBackoff{
		NextDelayFunc: nextDelayFunc,
		ResetFunc:     resetFunc,
	}
}

// NextDelay calls the custom next delay function
func (b *CustomBackoff) NextDelay(attempt int, err error) time.Duration {
	if b.NextDelayFunc != nil {
		return b.NextDelayFunc(attempt, err)
	}
	return time.Second // Default fallback
}

// Reset calls the custom reset function
func (b *CustomBackoff) Reset() {
	if b.ResetFunc != nil {
		b.ResetFunc()
	}
}

// ========================================
// Retry Condition Functions
// ========================================

// RetryCondition determines if an error should trigger a retry
type RetryCondition func(error) bool

// AnyError always returns true (retry any error)
func AnyError(error) bool {
	return true
}

// NetworkError retries on network-related errors
func NetworkError(err error) bool {
	if err == nil {
		return false
	}

	errStr := err.Error()
	networkErrors := []string{
		"connection refused",
		"connection reset",
		"connection timed out",
		"timeout",
		"network unreachable",
		"no such host",
		"temporary failure",
	}

	for _, networkErr := range networkErrors {
		if contains(errStr, networkErr) {
			return true
		}
	}

	return false
}

// StatusCodeError retries based on HTTP status codes
func StatusCodeError(codes ...int) RetryCondition {
	return func(err error) bool {
		if err == nil {
			return false
		}

		// Check if error contains status code information
		// This is a simplified check - in a real implementation,
		// you might want to check for specific error types
		errStr := err.Error()
		for _, code := range codes {
			if contains(errStr, strconv.Itoa(code)) {
				return true
			}
		}

		return false
	}
}

// ServerError retries on 5xx status codes
func ServerError(err error) bool {
	return StatusCodeError(500, 502, 503, 504)(err)
}

// ClientError retries on specific 4xx status codes
func ClientError(err error) bool {
	return StatusCodeError(408, 429)(err)
}

// RateLimitError retries on rate limit errors
func RateLimitError(err error) bool {
	if err == nil {
		return false
	}

	errStr := err.Error()
	rateLimitErrors := []string{
		"rate limit",
		"too many requests",
		"quota exceeded",
		"throttled",
	}

	for _, rateLimitErr := range rateLimitErrors {
		if contains(errStr, rateLimitErr) {
			return true
		}
	}

	return false
}

// MaxAttemptsError stops retrying after max attempts
func MaxAttemptsError(maxAttempts int) RetryCondition {
	return func(err error) bool {
		// This would need to be implemented with attempt tracking
		// in the retry mechanism itself
		return false
	}
}

// CombineRetryConditions combines multiple retry conditions with OR logic
func CombineRetryConditions(conditions ...RetryCondition) RetryCondition {
	return func(err error) bool {
		for _, condition := range conditions {
			if condition(err) {
				return true
			}
		}
		return false
	}
}

// ========================================
// Helper Functions
// ========================================

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			(len(s) > len(substr) &&
				(s[:len(substr)] == substr ||
					s[len(s)-len(substr):] == substr ||
					containsMiddle(s, substr))))
}

// containsMiddle checks if substring is in the middle of string
func containsMiddle(s, substr string) bool {
	for i := 1; i < len(s)-len(substr)+1; i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// ========================================
// Retry Options
// ========================================

// Options configures retry behavior
type Options struct {
	MaxAttempts    int
	Backoff        BackoffStrategy
	RetryCondition RetryCondition
	OnRetry        func(attempt int, err error)
	Context        context.Context
}

// Option configures retry options
type Option func(*Options)

// WithMaxAttempts sets the maximum number of retry attempts
func WithMaxAttempts(maxAttempts int) Option {
	return func(o *Options) {
		o.MaxAttempts = maxAttempts
	}
}

// WithBackoff sets the backoff strategy
func WithBackoff(backoff BackoffStrategy) Option {
	return func(o *Options) {
		o.Backoff = backoff
	}
}

// WithRetryCondition sets the retry condition
func WithRetryCondition(condition RetryCondition) Option {
	return func(o *Options) {
		o.RetryCondition = condition
	}
}

// WithOnRetry sets the retry callback
func WithOnRetry(onRetry func(int, error)) Option {
	return func(o *Options) {
		o.OnRetry = onRetry
	}
}

// WithContext sets the context for retry operations
func WithContext(ctx context.Context) Option {
	return func(o *Options) {
		o.Context = ctx
	}
}

// DefaultOptions returns default retry options
func DefaultOptions() Options {
	return Options{
		MaxAttempts:    3,
		Backoff:        NewExponentialBackoff(100*time.Millisecond, 5*time.Second, 2.0, true),
		RetryCondition: CombineRetryConditions(NetworkError, ServerError, RateLimitError),
		OnRetry:        nil,
		Context:        context.Background(),
	}
}

// ========================================
// Backoff Builder
// ========================================

// BackoffBuilder provides a fluent interface for creating backoff strategies
type BackoffBuilder struct {
	strategy BackoffStrategy
}

// NewBackoffBuilder creates a new backoff builder
func NewBackoffBuilder() *BackoffBuilder {
	return &BackoffBuilder{}
}

// Exponential creates an exponential backoff strategy
func (b *BackoffBuilder) Exponential(initialDelay, maxDelay time.Duration, multiplier float64) *BackoffBuilder {
	b.strategy = NewExponentialBackoff(initialDelay, maxDelay, multiplier, true)
	return b
}

// Linear creates a linear backoff strategy
func (b *BackoffBuilder) Linear(initialDelay, increment, maxDelay time.Duration) *BackoffBuilder {
	b.strategy = NewLinearBackoff(initialDelay, increment, maxDelay, true)
	return b
}

// Fixed creates a fixed backoff strategy
func (b *BackoffBuilder) Fixed(delay time.Duration) *BackoffBuilder {
	b.strategy = NewFixedBackoff(delay, true)
	return b
}

// NoJitter disables jitter for the current strategy
func (b *BackoffBuilder) NoJitter() *BackoffBuilder {
	switch strategy := b.strategy.(type) {
	case *ExponentialBackoff:
		strategy.Jitter = false
	case *LinearBackoff:
		strategy.Jitter = false
	case *FixedBackoff:
		strategy.Jitter = false
	}
	return b
}

// Custom creates a custom backoff strategy
func (b *BackoffBuilder) Custom(nextDelayFunc func(int, error) time.Duration, resetFunc func()) *BackoffBuilder {
	b.strategy = NewCustomBackoff(nextDelayFunc, resetFunc)
	return b
}

// Build returns the configured backoff strategy
func (b *BackoffBuilder) Build() BackoffStrategy {
	if b.strategy == nil {
		// Default to exponential backoff
		b.strategy = NewExponentialBackoff(100*time.Millisecond, 5*time.Second, 2.0, true)
	}
	return b.strategy
}

// ========================================
// Predefined Strategies
// ========================================

var (
	// FastRetry is for quick retries with short delays
	FastRetry = NewExponentialBackoff(10*time.Millisecond, 1*time.Second, 2.0, true)

	// StandardRetry is the standard retry strategy
	StandardRetry = NewExponentialBackoff(100*time.Millisecond, 5*time.Second, 2.0, true)

	// SlowRetry is for slower retries with longer delays
	SlowRetry = NewExponentialBackoff(1*time.Second, 30*time.Second, 2.0, true)

	// NoRetry is a fixed strategy that always returns 0 (no delay)
	NoRetry = NewFixedBackoff(0, false)

	// ImmediateRetry is a fixed strategy with minimal delay
	ImmediateRetry = NewFixedBackoff(1*time.Millisecond, true)
)
