package api

import (
	"sync"
	"time"
)

type bucket struct {
	tokens     float64
	maxTokens  float64
	refillRate float64
	lastRefill time.Time
	mu         sync.Mutex
}

func newBucket(refillRate float64, maxTokens float64) *bucket {
	return &bucket{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

func (b *bucket) allow(tokens float64) (bool, float64) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.refill()

	if b.tokens >= tokens {
		b.tokens -= tokens
		return true, b.tokens
	}

	return false, b.tokens
}

func (b *bucket) refill() {
	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.lastRefill = now

	newTokens := b.tokens + (elapsed * b.refillRate)
	if newTokens > b.maxTokens {
		newTokens = b.maxTokens
	}
	b.tokens = newTokens
}

func (b *bucket) remaining() float64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refill()
	return b.tokens
}

func (b *bucket) resetAt() time.Time {
	b.mu.Lock()
	defer b.mu.Unlock()

	tokensNeeded := b.maxTokens - b.tokens
	if tokensNeeded <= 0 {
		return time.Now()
	}

	secondsNeeded := tokensNeeded / b.refillRate
	return time.Now().Add(time.Duration(secondsNeeded) * time.Second)
}
