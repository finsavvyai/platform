package ingestion

import (
	"sync"
	"time"
)

// CircuitBreaker tracks consecutive failures and opens the circuit.
type CircuitBreaker struct {
	mu          sync.Mutex
	failures    int
	lastFailure time.Time
	threshold   int
	cooldown    time.Duration
}

// NewCircuitBreaker creates a breaker with given threshold and cooldown.
func NewCircuitBreaker(threshold int, cooldown time.Duration) *CircuitBreaker {
	return &CircuitBreaker{threshold: threshold, cooldown: cooldown}
}

// IsOpen returns true if breaker has tripped and cooldown has not elapsed.
func (cb *CircuitBreaker) IsOpen() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.failures < cb.threshold {
		return false
	}
	return time.Since(cb.lastFailure) < cb.cooldown
}

func (cb *CircuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
}

func (cb *CircuitBreaker) reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures = 0
}
