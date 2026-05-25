package circuitbreaker

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCircuitBreaker_New(t *testing.T) {
	config := DefaultConfig()
	cb := New(config)

	assert.Equal(t, StateClosed, cb.State())
	assert.Equal(t, config.Name, cb.config.Name)
	assert.NotNil(t, cb.logger)
	assert.NotNil(t, cb.tracer)
}

func TestCircuitBreaker_Execute_Success(t *testing.T) {
	config := DefaultConfig()
	cb := New(config)

	ctx := context.Background()
	err := cb.Execute(ctx, func(ctx context.Context) error {
		return nil
	})

	assert.NoError(t, err)
	assert.Equal(t, StateClosed, cb.State())
}

func TestCircuitBreaker_Execute_Failure(t *testing.T) {
	config := DefaultConfig()
	config.MaxFailures = 3
	cb := New(config)

	ctx := context.Background()

	// Execute 3 failing requests to open the circuit
	for i := 0; i < 3; i++ {
		err := cb.Execute(ctx, func(ctx context.Context) error {
			return errors.New("test error")
		})
		assert.Error(t, err)
	}

	// Circuit should now be open
	assert.Equal(t, StateOpen, cb.State())

	// Next request should fail fast
	err := cb.Execute(ctx, func(ctx context.Context) error {
		return nil
	})
	assert.ErrorIs(t, err, ErrCircuitBreakerOpen)
}

func TestCircuitBreaker_Execute_Timeout(t *testing.T) {
	config := DefaultConfig()
	config.RequestTimeout = 100 * time.Millisecond
	cb := New(config)

	ctx := context.Background()
	err := cb.Execute(ctx, func(ctx context.Context) error {
		time.Sleep(200 * time.Millisecond)
		return nil
	})

	assert.Error(t, err)
	assert.ErrorContains(t, err, "context deadline exceeded")
}

func TestCircuitBreaker_ExecuteWithResult(t *testing.T) {
	config := DefaultConfig()
	cb := New(config)

	ctx := context.Background()
	result, err := cb.ExecuteWithResult(ctx, func(ctx context.Context) (interface{}, error) {
		return "test-result", nil
	})

	assert.NoError(t, err)
	assert.Equal(t, "test-result", result)
}

func TestCircuitBreaker_HalfOpenToClosed(t *testing.T) {
	config := DefaultConfig()
	config.MaxFailures = 2
	config.SuccessThreshold = 2
	config.ResetTimeout = 100 * time.Millisecond
	cb := New(config)

	ctx := context.Background()

	// Fail to open circuit
	for i := 0; i < 2; i++ {
		cb.Execute(ctx, func(ctx context.Context) error {
			return errors.New("test error")
		})
	}

	assert.Equal(t, StateOpen, cb.State())

	// Wait for reset timeout
	time.Sleep(150 * time.Millisecond)

	// Execute successful requests to close circuit
	for i := 0; i < 2; i++ {
		err := cb.Execute(ctx, func(ctx context.Context) error {
			return nil
		})
		assert.NoError(t, err)
	}

	assert.Equal(t, StateClosed, cb.State())
}

func TestCircuitBreaker_HalfOpenToOpen(t *testing.T) {
	config := DefaultConfig()
	config.MaxFailures = 2
	config.FailureThreshold = 1
	config.ResetTimeout = 100 * time.Millisecond
	cb := New(config)

	ctx := context.Background()

	// Fail to open circuit
	for i := 0; i < 2; i++ {
		cb.Execute(ctx, func(ctx context.Context) error {
			return errors.New("test error")
		})
	}

	assert.Equal(t, StateOpen, cb.State())

	// Wait for reset timeout
	time.Sleep(150 * time.Millisecond)

	// Execute a failing request in half-open state
	err := cb.Execute(ctx, func(ctx context.Context) error {
		return errors.New("test error")
	})
	assert.Error(t, err)

	assert.Equal(t, StateOpen, cb.State())
}

func TestCircuitBreaker_Metrics(t *testing.T) {
	config := DefaultConfig()
	cb := New(config)

	ctx := context.Background()

	// Execute some requests
	for i := 0; i < 5; i++ {
		cb.Execute(ctx, func(ctx context.Context) error {
			if i%2 == 0 {
				return nil
			}
			return errors.New("test error")
		})
	}

	metrics := cb.Metrics()
	assert.Equal(t, uint64(5), metrics.TotalRequests)
	assert.Equal(t, uint64(3), metrics.SuccessfulRequests)
	assert.Equal(t, uint64(2), metrics.FailedRequests)
	assert.Equal(t, StateClosed, metrics.CurrentState)
}

func TestCircuitBreaker_Reset(t *testing.T) {
	config := DefaultConfig()
	cb := New(config)

	ctx := context.Background()

	// Fail to open circuit
	for i := 0; i < config.MaxFailures; i++ {
		cb.Execute(ctx, func(ctx context.Context) error {
			return errors.New("test error")
		})
	}

	assert.Equal(t, StateOpen, cb.State())

	// Reset circuit
	cb.Reset()

	assert.Equal(t, StateClosed, cb.State())
	assert.Equal(t, 0, cb.failures)
	assert.Equal(t, 0, cb.successes)
}

func TestCircuitBreaker_StateChangeCallback(t *testing.T) {
	config := DefaultConfig()
	cb := New(config)

	var callbackOldState, callbackNewState State
	var callbackCalled bool

	cb.SetStateChangeCallback(func(oldState, newState State) {
		callbackOldState = oldState
		callbackNewState = newState
		callbackCalled = true
	})

	ctx := context.Background()

	// Fail to open circuit
	for i := 0; i < config.MaxFailures; i++ {
		cb.Execute(ctx, func(ctx context.Context) error {
			return errors.New("test error")
		})
	}

	assert.True(t, callbackCalled)
	assert.Equal(t, StateClosed, callbackOldState)
	assert.Equal(t, StateOpen, callbackNewState)
}

func TestCircuitBreaker_ConcurrentExecution(t *testing.T) {
	config := DefaultConfig()
	config.MaxFailures = 10
	cb := New(config)

	ctx := context.Background()
	var wg sync.WaitGroup
	errors := make([]error, 100)

	// Execute 100 requests concurrently
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			errors[index] = cb.Execute(ctx, func(ctx context.Context) error {
				time.Sleep(10 * time.Millisecond)
				return nil
			})
		}(i)
	}

	wg.Wait()

	// Check that all requests completed
	for _, err := range errors {
		assert.NoError(t, err)
	}

	assert.Equal(t, StateClosed, cb.State())
	metrics := cb.Metrics()
	assert.Equal(t, uint64(100), metrics.TotalRequests)
	assert.Equal(t, uint64(100), metrics.SuccessfulRequests)
}

func TestCircuitBreaker_RequestCallback(t *testing.T) {
	config := DefaultConfig()
	cb := New(config)

	var callbackSuccess bool
	var callbackDuration time.Duration
	var callbackCount int

	cb.SetRequestCallback(func(success bool, duration time.Duration) {
		callbackSuccess = success
		callbackDuration = duration
		callbackCount++
	})

	ctx := context.Background()

	// Execute a request
	cb.Execute(ctx, func(ctx context.Context) error {
		time.Sleep(10 * time.Millisecond)
		return nil
	})

	assert.Equal(t, 1, callbackCount)
	assert.True(t, callbackSuccess)
	assert.Greater(t, callbackDuration, 10*time.Millisecond)
}

func TestRegistry_NewRegistry(t *testing.T) {
	registry := NewRegistry()

	assert.NotNil(t, registry)
	assert.NotNil(t, registry.breakers)
	assert.NotNil(t, registry.logger)
	assert.Empty(t, registry.breakers)
}

func TestRegistry_GetOrCreate(t *testing.T) {
	registry := NewRegistry()
	config := DefaultConfig()

	// Create new circuit breaker
	cb1 := registry.GetOrCreate("test", config)
	assert.NotNil(t, cb1)

	// Get existing circuit breaker
	cb2 := registry.GetOrCreate("test", config)
	assert.Same(t, cb1, cb2)

	// Create different circuit breaker
	cb3 := registry.GetOrCreate("test2", config)
	assert.NotSame(t, cb1, cb3)
	assert.Equal(t, "test2", cb3.config.Name)
}

func TestRegistry_Get(t *testing.T) {
	registry := NewRegistry()
	config := DefaultConfig()

	// Get non-existent circuit breaker
	cb, exists := registry.Get("nonexistent")
	assert.Nil(t, cb)
	assert.False(t, exists)

	// Create and get circuit breaker
	registry.GetOrCreate("test", config)
	cb, exists = registry.Get("test")
	assert.NotNil(t, cb)
	assert.True(t, exists)
}

func TestRegistry_List(t *testing.T) {
	registry := NewRegistry()
	config := DefaultConfig()

	// Empty registry
	names := registry.List()
	assert.Empty(t, names)

	// Add circuit breakers
	registry.GetOrCreate("test1", config)
	registry.GetOrCreate("test2", config)
	registry.GetOrCreate("test3", config)

	names = registry.List()
	assert.Len(t, names, 3)
	assert.Contains(t, names, "test1")
	assert.Contains(t, names, "test2")
	assert.Contains(t, names, "test3")
}

func TestRegistry_GetAllMetrics(t *testing.T) {
	registry := NewRegistry()
	config := DefaultConfig()

	// Create circuit breakers
	cb1 := registry.GetOrCreate("test1", config)
	cb2 := registry.GetOrCreate("test2", config)

	// Execute some requests
	ctx := context.Background()
	cb1.Execute(ctx, func(ctx context.Context) error { return nil })
	cb2.Execute(ctx, func(ctx context.Context) error { return errors.New("error") })

	// Get all metrics
	metrics := registry.GetAllMetrics()
	assert.Len(t, metrics, 2)
	assert.Contains(t, metrics, "test1")
	assert.Contains(t, metrics, "test2")

	test1Metrics := metrics["test1"]
	assert.Equal(t, uint64(1), test1Metrics.TotalRequests)
	assert.Equal(t, uint64(1), test1Metrics.SuccessfulRequests)

	test2Metrics := metrics["test2"]
	assert.Equal(t, uint64(1), test2Metrics.TotalRequests)
	assert.Equal(t, uint64(1), test2Metrics.FailedRequests)
}

func TestRegistry_Shutdown(t *testing.T) {
	registry := NewRegistry()
	config := DefaultConfig()

	// Add circuit breakers
	registry.GetOrCreate("test1", config)
	registry.GetOrCreate("test2", config)

	assert.Len(t, registry.breakers, 2)

	// Shutdown registry
	registry.Shutdown()

	assert.Empty(t, registry.breakers)
}

func TestGlobalRegistry(t *testing.T) {
	// Test global registry functions
	ctx := context.Background()

	// Execute with default config
	err := Execute(ctx, "global-test", func(ctx context.Context) error {
		return nil
	})
	assert.NoError(t, err)

	// Execute with custom config
	config := DefaultConfig()
	config.MaxFailures = 1
	err = ExecuteWithConfig(ctx, "global-test-2", config, func(ctx context.Context) error {
		return errors.New("error")
	})
	assert.Error(t, err)

	// Execute with result
	result, err := ExecuteWithResult(ctx, "global-test-3", func(ctx context.Context) (interface{}, error) {
		return "success", nil
	})
	assert.NoError(t, err)
	assert.Equal(t, "success", result)

	// Verify circuit breakers exist in global registry
	registry := GetGlobalRegistry()
	cb, exists := registry.Get("global-test")
	assert.True(t, exists)
	assert.NotNil(t, cb)
}

// Benchmark tests
func BenchmarkCircuitBreaker_Execute_Success(b *testing.B) {
	config := DefaultConfig()
	cb := New(config)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cb.Execute(ctx, func(ctx context.Context) error {
			return nil
		})
	}
}

func BenchmarkCircuitBreaker_Execute_Concurrent(b *testing.B) {
	config := DefaultConfig()
	cb := New(config)
	ctx := context.Background()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			cb.Execute(ctx, func(ctx context.Context) error {
				return nil
			})
		}
	})
}
