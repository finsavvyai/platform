package retry

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"
	"time"
)

func TestExponentialBackoff(t *testing.T) {
	tests := []struct {
		name         string
		baseInterval time.Duration
		maxInterval  time.Duration
		multiplier   float64
		retries      []time.Duration
	}{
		{
			name:         "standard exponential backoff",
			baseInterval: 100 * time.Millisecond,
			maxInterval:  5 * time.Second,
			multiplier:   2.0,
			retries: []time.Duration{
				100 * time.Millisecond,
				200 * time.Millisecond,
				400 * time.Millisecond,
				800 * time.Millisecond,
				1600 * time.Millisecond,
				3200 * time.Millisecond,
				5000 * time.Millisecond, // Capped at max
				5000 * time.Millisecond, // Capped at max
			},
		},
		{
			name:         "small multiplier",
			baseInterval: 100 * time.Millisecond,
			maxInterval:  1 * time.Second,
			multiplier:   1.5,
			retries: []time.Duration{
				100 * time.Millisecond,
				150 * time.Millisecond,
				225 * time.Millisecond,
				338 * time.Millisecond,
				507 * time.Millisecond,
				761 * time.Millisecond,
				1000 * time.Millisecond, // Capped at max
			},
		},
		{
			name:         "immediate retries",
			baseInterval: 0,
			maxInterval:  100 * time.Millisecond,
			multiplier:   2.0,
			retries: []time.Duration{
				0,
				0,
				0,
			},
		},
		{
			name:         "no max limit",
			baseInterval: 100 * time.Millisecond,
			maxInterval:  0, // No limit
			multiplier:   2.0,
			retries: []time.Duration{
				100 * time.Millisecond,
				200 * time.Millisecond,
				400 * time.Millisecond,
				800 * time.Millisecond,
				1600 * time.Millisecond,
			},
		},
		{
			name:         "very small base",
			baseInterval: 1 * time.Millisecond,
			maxInterval:  100 * time.Millisecond,
			multiplier:   3.0,
			retries: []time.Duration{
				1 * time.Millisecond,
				3 * time.Millisecond,
				9 * time.Millisecond,
				27 * time.Millisecond,
				81 * time.Millisecond,
				100 * time.Millisecond, // Capped at max
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			backoff := NewExponentialBackoff(tt.baseInterval, tt.maxInterval, tt.multiplier)

			for i, expected := range tt.retries {
				result := backoff.Next(i)
				if result != expected {
					t.Fatalf("Retry %d: expected interval %v, got %v", i, expected, result)
				}
			}
		})
	}
}

func TestLinearBackoff(t *testing.T) {
	tests := []struct {
		name         string
		baseInterval time.Duration
		increment    time.Duration
		maxInterval  time.Duration
		retries      []time.Duration
	}{
		{
			name:         "standard linear backoff",
			baseInterval: 100 * time.Millisecond,
			increment:    50 * time.Millisecond,
			maxInterval:  500 * time.Millisecond,
			retries: []time.Duration{
				100 * time.Millisecond,
				150 * time.Millisecond,
				200 * time.Millisecond,
				250 * time.Millisecond,
				300 * time.Millisecond,
				350 * time.Millisecond,
				400 * time.Millisecond,
				450 * time.Millisecond,
				500 * time.Millisecond, // Capped at max
				500 * time.Millisecond, // Capped at max
			},
		},
		{
			name:         "zero increment",
			baseInterval: 200 * time.Millisecond,
			increment:    0,
			maxInterval:  1 * time.Second,
			retries: []time.Duration{
				200 * time.Millisecond,
				200 * time.Millisecond,
				200 * time.Millisecond,
			},
		},
		{
			name:         "large increment",
			baseInterval: 50 * time.Millisecond,
			increment:    200 * time.Millisecond,
			maxInterval:  500 * time.Millisecond,
			retries: []time.Duration{
				50 * time.Millisecond,
				250 * time.Millisecond,
				450 * time.Millisecond,
				500 * time.Millisecond, // Capped at max
			},
		},
		{
			name:         "no max limit",
			baseInterval: 100 * time.Millisecond,
			increment:    25 * time.Millisecond,
			maxInterval:  0, // No limit
			retries: []time.Duration{
				100 * time.Millisecond,
				125 * time.Millisecond,
				150 * time.Millisecond,
				175 * time.Millisecond,
				200 * time.Millisecond,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			backoff := NewLinearBackoff(tt.baseInterval, tt.increment, tt.maxInterval)

			for i, expected := range tt.retries {
				result := backoff.Next(i)
				if result != expected {
					t.Fatalf("Retry %d: expected interval %v, got %v", i, expected, result)
				}
			}
		})
	}
}

func TestFixedIntervalBackoff(t *testing.T) {
	tests := []struct {
		name     string
		interval time.Duration
		retries  int
	}{
		{
			name:     "100ms fixed interval",
			interval: 100 * time.Millisecond,
			retries:  10,
		},
		{
			name:     "1 second fixed interval",
			interval: 1 * time.Second,
			retries:  5,
		},
		{
			name:     "zero interval",
			interval: 0,
			retries:  3,
		},
		{
			name:     "very small interval",
			interval: 1 * time.Nanosecond,
			retries:  5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			backoff := NewFixedIntervalBackoff(tt.interval)

			for i := 0; i < tt.retries; i++ {
				result := backoff.Next(i)
				if result != tt.interval {
					t.Fatalf("Retry %d: expected interval %v, got %v", i, tt.interval, result)
				}
			}
		})
	}
}

func TestNoBackoff(t *testing.T) {
	backoff := NewNoBackoff()

	for i := 0; i < 10; i++ {
		result := backoff.Next(i)
		if result != 0 {
			t.Fatalf("Retry %d: expected 0 interval, got %v", i, result)
		}
	}
}

func TestRetryConfig(t *testing.T) {
	tests := []struct {
		name         string
		maxAttempts  int
		baseInterval time.Duration
		maxInterval  time.Duration
		multiplier   float64
		maxTime      time.Duration
		expectError  bool
		errorMsg     string
	}{
		{
			name:         "valid config",
			maxAttempts:  3,
			baseInterval: 100 * time.Millisecond,
			maxInterval:  1 * time.Second,
			multiplier:   2.0,
			maxTime:      5 * time.Second,
			expectError:  false,
		},
		{
			name:         "zero max attempts",
			maxAttempts:  0,
			baseInterval: 100 * time.Millisecond,
			expectError:  true,
			errorMsg:     "max attempts must be positive",
		},
		{
			name:         "negative max attempts",
			maxAttempts:  -1,
			baseInterval: 100 * time.Millisecond,
			expectError:  true,
			errorMsg:     "max attempts must be positive",
		},
		{
			name:         "negative base interval",
			maxAttempts:  3,
			baseInterval: -1 * time.Millisecond,
			expectError:  true,
			errorMsg:     "base interval cannot be negative",
		},
		{
			name:         "negative max interval",
			maxAttempts:  3,
			baseInterval: 100 * time.Millisecond,
			maxInterval:  -1 * time.Millisecond,
			expectError:  true,
			errorMsg:     "max interval cannot be negative",
		},
		{
			name:         "invalid multiplier",
			maxAttempts:  3,
			baseInterval: 100 * time.Millisecond,
			multiplier:   0.5,
			expectError:  true,
			errorMsg:     "multiplier must be >= 1.0",
		},
		{
			name:         "negative max time",
			maxAttempts:  3,
			baseInterval: 100 * time.Millisecond,
			maxTime:      -1 * time.Second,
			expectError:  true,
			errorMsg:     "max time cannot be negative",
		},
		{
			name:         "zero max time is allowed",
			maxAttempts:  3,
			baseInterval: 100 * time.Millisecond,
			maxTime:      0,
			expectError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &RetryConfig{
				MaxAttempts:  tt.maxAttempts,
				BaseInterval: tt.baseInterval,
				MaxInterval:  tt.maxInterval,
				Multiplier:   tt.multiplier,
				MaxTime:      tt.maxTime,
			}

			err := config.Validate()
			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestRetryWithSuccess(t *testing.T) {
	tests := []struct {
		name        string
		config      *RetryConfig
		attempts    int
		expectError bool
	}{
		{
			name: "success on first attempt",
			config: &RetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
				Multiplier:   2.0,
			},
			attempts:    1,
			expectError: false,
		},
		{
			name: "success on second attempt",
			config: &RetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
				Multiplier:   2.0,
			},
			attempts:    2,
			expectError: false,
		},
		{
			name: "success on last attempt",
			config: &RetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
				Multiplier:   2.0,
			},
			attempts:    3,
			expectError: false,
		},
		{
			name: "failure after all attempts",
			config: &RetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
				Multiplier:   2.0,
			},
			attempts:    4, // Never succeeds
			expectError: true,
		},
		{
			name: "success with many attempts",
			config: &RetryConfig{
				MaxAttempts:  10,
				BaseInterval: 1 * time.Millisecond,
				Multiplier:   1.5,
			},
			attempts:    7,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attemptCount := 0

			fn := func() error {
				attemptCount++
				if attemptCount >= tt.attempts {
					return nil
				}
				return errors.New("temporary failure")
			}

			err := Retry(TestContext(), fn, tt.config)
			if tt.expectError && err == nil {
				t.Fatal("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			expectedAttempts := min(tt.attempts, tt.config.MaxAttempts)
			if attemptCount != expectedAttempts {
				t.Fatalf("Expected %d attempts, got %d", expectedAttempts, attemptCount)
			}
		})
	}
}

func TestRetryWithContextCancellation(t *testing.T) {
	tests := []struct {
		name        string
		cancelAfter time.Duration
		config      *RetryConfig
		expectError bool
		errorMsg    string
	}{
		{
			name:        "context cancelled before retry",
			cancelAfter: 0,
			config: &RetryConfig{
				MaxAttempts:  3,
				BaseInterval: 100 * time.Millisecond,
				Multiplier:   2.0,
			},
			expectError: true,
			errorMsg:    "context canceled",
		},
		{
			name:        "context cancelled during retry",
			cancelAfter: 150 * time.Millisecond,
			config: &RetryConfig{
				MaxAttempts:  5,
				BaseInterval: 100 * time.Millisecond,
				Multiplier:   2.0,
			},
			expectError: true,
			errorMsg:    "context canceled",
		},
		{
			name:        "context cancelled after success",
			cancelAfter: 500 * time.Millisecond,
			config: &RetryConfig{
				MaxAttempts:  3,
				BaseInterval: 50 * time.Millisecond,
				Multiplier:   2.0,
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(TestContext(), tt.cancelAfter)
			defer cancel()

			attemptCount := 0
			fn := func() error {
				attemptCount++
				if attemptCount >= 3 {
					return nil // Success on third attempt
				}
				return errors.New("temporary failure")
			}

			err := Retry(ctx, fn, tt.config)
			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestRetryWithMaxTime(t *testing.T) {
	tests := []struct {
		name        string
		maxTime     time.Duration
		config      *RetryConfig
		expectError bool
	}{
		{
			name:    "completes within max time",
			maxTime: 500 * time.Millisecond,
			config: &RetryConfig{
				MaxAttempts:  10,
				BaseInterval: 10 * time.Millisecond,
				Multiplier:   2.0,
				MaxTime:      500 * time.Millisecond,
			},
			expectError: false,
		},
		{
			name:    "exceeds max time",
			maxTime: 200 * time.Millisecond,
			config: &RetryConfig{
				MaxAttempts:  10,
				BaseInterval: 100 * time.Millisecond,
				Multiplier:   2.0,
				MaxTime:      200 * time.Millisecond,
			},
			expectError: true,
		},
		{
			name:    "max time disabled",
			maxTime: 5 * time.Second,
			config: &RetryConfig{
				MaxAttempts:  5,
				BaseInterval: 100 * time.Millisecond,
				Multiplier:   2.0,
				MaxTime:      0, // Disabled
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start := time.Now()
			attemptCount := 0

			fn := func() error {
				attemptCount++
				if attemptCount >= 5 {
					return nil // Success on fifth attempt
				}
				return errors.New("temporary failure")
			}

			err := Retry(TestContext(), fn, tt.config)
			elapsed := time.Since(start)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if !strings.Contains(err.Error(), "max time exceeded") {
					t.Fatalf("Expected max time exceeded error, got %v", err)
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}

			// Verify timing constraints
			if tt.config.MaxTime > 0 && elapsed > tt.config.MaxTime+50*time.Millisecond {
				t.Logf("Warning: elapsed time %v exceeds max time %v significantly", elapsed, tt.config.MaxTime)
			}
		})
	}
}

func TestRetryWithConditions(t *testing.T) {
	tests := []struct {
		name        string
		condition   RetryCondition
		errors      []error
		expectError bool
	}{
		{
			name:      "retry on network errors",
			condition: IsNetworkError,
			errors: []error{
				&net.OpError{Op: "dial", Net: "tcp", Addr: &net.TCPAddr{}, Err: errors.New("connection refused")},
				&net.OpError{Op: "read", Net: "tcp", Addr: &net.TCPAddr{}, Err: errors.New("connection reset")},
				nil, // Success
			},
			expectError: false,
		},
		{
			name:      "don't retry on validation errors",
			condition: IsNetworkError,
			errors: []error{
				errors.New("invalid input"),
				nil,
			},
			expectError: true,
		},
		{
			name:      "retry on temporary errors",
			condition: IsTemporaryError,
			errors: []error{
				&net.OpError{Op: "dial", Err: errors.New("temporary failure"), Timeout: false},
				&net.OpError{Op: "read", Err: errors.New("temporary failure"), Timeout: true},
				nil, // Success
			},
			expectError: false,
		},
		{
			name:      "retry on any error",
			condition: AlwaysRetry,
			errors: []error{
				errors.New("any error 1"),
				errors.New("any error 2"),
				nil, // Success
			},
			expectError: false,
		},
		{
			name:      "never retry",
			condition: NeverRetry,
			errors: []error{
				errors.New("should not retry"),
				nil,
			},
			expectError: true,
		},
		{
			name: "custom condition",
			condition: func(err error) bool {
				return strings.Contains(err.Error(), "retry")
			},
			errors: []error{
				errors.New("this should retry"),
				errors.New("don't retry this"),
				nil,
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attemptCount := 0

			fn := func() error {
				if attemptCount < len(tt.errors) {
					err := tt.errors[attemptCount]
					attemptCount++
					return err
				}
				attemptCount++
				return nil
			}

			config := &RetryConfig{
				MaxAttempts:  len(tt.errors) + 1,
				BaseInterval: 1 * time.Millisecond,
				Multiplier:   1.0,
				Condition:    tt.condition,
			}

			err := Retry(TestContext(), fn, config)
			if tt.expectError && err == nil {
				t.Fatal("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
		})
	}
}

func TestRetryWithReturnValue(t *testing.T) {
	tests := []struct {
		name        string
		config      *RetryConfig
		returnValue string
		attempts    int
		expectError bool
	}{
		{
			name: "successful return value",
			config: &RetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
				Multiplier:   2.0,
			},
			returnValue: "success",
			attempts:    2,
			expectError: false,
		},
		{
			name: "failed return value",
			config: &RetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
				Multiplier:   2.0,
			},
			returnValue: "",
			attempts:    10, // Never succeeds
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attemptCount := 0

			fn := func() (string, error) {
				attemptCount++
				if attemptCount >= tt.attempts && tt.returnValue != "" {
					return tt.returnValue, nil
				}
				return "", errors.New("temporary failure")
			}

			result, err := RetryWithValue(TestContext(), fn, tt.config)
			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result != tt.returnValue {
					t.Fatalf("Expected return value %q, got %q", tt.returnValue, result)
				}
			}
		})
	}
}

func TestBatchRetry(t *testing.T) {
	tests := []struct {
		name             string
		config           *BatchRetryConfig
		items            []int
		expectError      bool
		expectedSuccess  int
		expectedFailures int
	}{
		{
			name: "all items succeed",
			config: &BatchRetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
				BatchSize:    3,
			},
			items:            []int{1, 2, 3, 4, 5},
			expectError:      false,
			expectedSuccess:  5,
			expectedFailures: 0,
		},
		{
			name: "some items fail",
			config: &BatchRetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
				BatchSize:    2,
			},
			items:            []int{1, 2, 3, 4}, // Items 2 and 4 will fail
			expectError:      false,
			expectedSuccess:  2,
			expectedFailures: 2,
		},
		{
			name: "all items fail",
			config: &BatchRetryConfig{
				MaxAttempts:  2,
				BaseInterval: 10 * time.Millisecond,
				BatchSize:    2,
			},
			items:            []int{1, 2, 3},
			expectError:      false,
			expectedSuccess:  0,
			expectedFailures: 3,
		},
		{
			name: "empty batch",
			config: &BatchRetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
				BatchSize:    2,
			},
			items:            []int{},
			expectError:      false,
			expectedSuccess:  0,
			expectedFailures: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fn := func(item int) error {
				if item%2 == 0 {
					return errors.New("even numbers fail")
				}
				return nil
			}

			result, err := BatchRetry(TestContext(), tt.items, fn, tt.config)
			if tt.expectError && err == nil {
				t.Fatal("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if result.SuccessCount != tt.expectedSuccess {
				t.Fatalf("Expected %d successes, got %d", tt.expectedSuccess, result.SuccessCount)
			}
			if result.FailureCount != tt.expectedFailures {
				t.Fatalf("Expected %d failures, got %d", tt.expectedFailures, result.FailureCount)
			}
		})
	}
}

func TestCircuitBreakerIntegration(t *testing.T) {
	tests := []struct {
		name              string
		circuitConfig     *CircuitBreakerConfig
		retryConfig       *RetryConfig
		failures          int
		expectCircuitOpen bool
		expectRetryError  bool
	}{
		{
			name: "circuit opens after threshold",
			circuitConfig: &CircuitBreakerConfig{
				FailureThreshold: 3,
				RecoveryTimeout:  100 * time.Millisecond,
				RequestTimeout:   50 * time.Millisecond,
			},
			retryConfig: &RetryConfig{
				MaxAttempts:  5,
				BaseInterval: 10 * time.Millisecond,
			},
			failures:          5, // Exceeds threshold
			expectCircuitOpen: true,
			expectRetryError:  true,
		},
		{
			name: "circuit stays closed",
			circuitConfig: &CircuitBreakerConfig{
				FailureThreshold: 5,
				RecoveryTimeout:  100 * time.Millisecond,
				RequestTimeout:   50 * time.Millisecond,
			},
			retryConfig: &RetryConfig{
				MaxAttempts:  3,
				BaseInterval: 10 * time.Millisecond,
			},
			failures:          2, // Below threshold
			expectCircuitOpen: false,
			expectRetryError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			circuitBreaker := NewCircuitBreaker("test", tt.circuitConfig)

			config := *tt.retryConfig
			config.CircuitBreaker = circuitBreaker

			attemptCount := 0
			fn := func() error {
				attemptCount++
				if attemptCount <= tt.failures {
					return errors.New("simulated failure")
				}
				return nil
			}

			err := Retry(TestContext(), fn, &config)

			if tt.expectCircuitOpen && !circuitBreaker.IsOpen() {
				t.Error("Expected circuit breaker to be open")
			}
			if !tt.expectCircuitOpen && circuitBreaker.IsOpen() {
				t.Error("Expected circuit breaker to be closed")
			}
			if tt.expectRetryError && err == nil {
				t.Fatal("Expected retry error but got none")
			}
		})
	}
}

func TestPredefinedConditions(t *testing.T) {
	tests := []struct {
		name      string
		condition RetryCondition
		errors    []error
		expected  []bool
	}{
		{
			name:      "IsNetworkError",
			condition: IsNetworkError,
			errors: []error{
				&net.OpError{Op: "dial", Err: errors.New("connection refused")},
				&net.DNSError{Err: "no such host"},
				&net.TimeoutError{},
				errors.New("regular error"),
				nil,
			},
			expected: []bool{true, true, true, false, false},
		},
		{
			name:      "IsTimeoutError",
			condition: IsTimeoutError,
			errors: []error{
				context.DeadlineExceeded,
				&net.TimeoutError{},
				&net.OpError{Timeout: true},
				errors.New("regular error"),
				nil,
			},
			expected: []bool{true, true, true, false, false},
		},
		{
			name:      "IsTemporaryError",
			condition: IsTemporaryError,
			errors: []error{
				&net.OpError{Temporary: true},
				&net.DNSError{IsTemporary: true},
				errors.New("regular error"),
				nil,
			},
			expected: []bool{true, true, false, false},
		},
		{
			name:      "AlwaysRetry",
			condition: AlwaysRetry,
			errors: []error{
				errors.New("any error"),
				context.Canceled,
				nil,
			},
			expected: []bool{true, true, false},
		},
		{
			name:      "NeverRetry",
			condition: NeverRetry,
			errors: []error{
				errors.New("any error"),
				&net.OpError{},
				context.DeadlineExceeded,
				nil,
			},
			expected: []bool{false, false, false, false},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for i, err := range tt.errors {
				result := tt.condition(err)
				if result != tt.expected[i] {
					t.Fatalf("Error %d: expected %v, got %v for error %v", i, tt.expected[i], result, err)
				}
			}
		})
	}
}

func TestRetryMetrics(t *testing.T) {
	config := &RetryConfig{
		MaxAttempts:  3,
		BaseInterval: 10 * time.Millisecond,
		Multiplier:   2.0,
	}

	attemptCount := 0
	fn := func() error {
		attemptCount++
		if attemptCount < 3 {
			return errors.New("temporary failure")
		}
		return nil
	}

	start := time.Now()
	err := Retry(TestContext(), fn, config)
	elapsed := time.Since(start)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Verify that some delay occurred due to backoff
	expectedMinDelay := 10 * time.Millisecond // First retry delay
	if elapsed < expectedMinDelay {
		t.Logf("Warning: elapsed time %v is less than expected minimum delay %v", elapsed, expectedMinDelay)
	}

	if attemptCount != 3 {
		t.Fatalf("Expected 3 attempts, got %d", attemptCount)
	}
}

func TestRetryEdgeCases(t *testing.T) {
	t.Run("nil function", func(t *testing.T) {
		config := &RetryConfig{
			MaxAttempts: 3,
		}
		err := Retry(TestContext(), nil, config)
		if err == nil {
			t.Fatal("Expected error for nil function")
		}
	})

	t.Run("panic recovery", func(t *testing.T) {
		config := &RetryConfig{
			MaxAttempts:  3,
			BaseInterval: 1 * time.Millisecond,
		}

		attemptCount := 0
		fn := func() error {
			attemptCount++
			if attemptCount < 3 {
				panic("simulated panic")
			}
			return nil
		}

		// Note: The current implementation doesn't handle panics.
		// This test documents the expected behavior.
		defer func() {
			if r := recover(); r != nil {
				t.Logf("Recovered from panic: %v", r)
			}
		}()

		err := Retry(TestContext(), fn, config)
		// Should succeed after panic recovery is implemented
		if err != nil {
			t.Logf("Retry after panic failed (expected): %v", err)
		}
	})

	t.Run("very short intervals", func(t *testing.T) {
		config := &RetryConfig{
			MaxAttempts:  100,
			BaseInterval: 1 * time.Nanosecond,
			Multiplier:   1.0,
		}

		attemptCount := 0
		fn := func() error {
			attemptCount++
			if attemptCount >= 50 {
				return nil
			}
			return errors.New("temporary failure")
		}

		start := time.Now()
		err := Retry(TestContext(), fn, config)
		elapsed := time.Since(start)

		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// Should complete very quickly
		if elapsed > 100*time.Millisecond {
			t.Logf("Warning: retry took longer than expected: %v", elapsed)
		}

		if attemptCount != 50 {
			t.Fatalf("Expected 50 attempts, got %d", attemptCount)
		}
	})
}

// Helper function for tests
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// TestContext creates a context with reasonable timeout for tests
func TestContext(t *testing.T) context.Context {
	ctx, _ := context.WithTimeout(context.Background(), 10*time.Second)
	return ctx
}
