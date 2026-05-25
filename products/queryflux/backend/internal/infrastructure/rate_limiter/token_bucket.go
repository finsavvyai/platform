package rate_limiter

import (
	"context"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/domain"
)

// TokenBucketLimiter implements rate limiting using the token bucket algorithm
type TokenBucketLimiter struct {
	buckets map[string]*TokenBucket
	mu      sync.RWMutex
	logger  *zap.Logger
}

// TokenBucket represents a token bucket for rate limiting
type TokenBucket struct {
	capacity   int           // Maximum number of tokens
	tokens     int           // Current number of tokens
	refillRate time.Duration // Time to add one token
	lastRefill time.Time     // Last time tokens were refilled
	mu         sync.Mutex    // Mutex for this bucket
}

// NewTokenBucketLimiter creates a new token bucket rate limiter
func NewTokenBucketLimiter(logger *zap.Logger) *TokenBucketLimiter {
	return &TokenBucketLimiter{
		buckets: make(map[string]*TokenBucket),
		logger:  logger,
	}
}

// getBucketKey generates a unique key for a user and service combination
func (r *TokenBucketLimiter) getBucketKey(userID string, service domain.AIService) string {
	return string(service) + ":" + userID
}

// getOrCreateBucket gets an existing bucket or creates a new one
func (r *TokenBucketLimiter) getOrCreateBucket(userID string, service domain.AIService, capacity int, refillRate time.Duration) *TokenBucket {
	key := r.getBucketKey(userID, service)

	r.mu.RLock()
	bucket, exists := r.buckets[key]
	r.mu.RUnlock()

	if !exists {
		r.mu.Lock()
		// Double-check after acquiring write lock
		if bucket, exists = r.buckets[key]; !exists {
			bucket = &TokenBucket{
				capacity:   capacity,
				tokens:     capacity, // Start with full bucket
				refillRate: refillRate,
				lastRefill: time.Now(),
			}
			r.buckets[key] = bucket
			r.logger.Debug("Created new token bucket",
				zap.String("user_id", userID),
				zap.String("service", string(service)),
				zap.Int("capacity", capacity))
		}
		r.mu.Unlock()
	}

	return bucket
}

// Allow checks if a request is allowed based on the rate limit
func (r *TokenBucketLimiter) Allow(ctx context.Context, userID string, service domain.AIService) (bool, time.Duration) {
	// Default rate limits: 10 requests per minute for all services
	capacity := 10
	refillRate := time.Minute / 10 // Add one token every 6 seconds

	// Service-specific rate limits could be configured here
	switch service {
	case domain.AIServiceOpenAI:
		capacity = 20
		refillRate = time.Minute / 20
	case domain.AIServiceClaude:
		capacity = 15
		refillRate = time.Minute / 15
	}

	bucket := r.getOrCreateBucket(userID, service, capacity, refillRate)

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	// Refill tokens based on elapsed time
	now := time.Now()
	elapsed := now.Sub(bucket.lastRefill)
	tokensToAdd := int(elapsed / bucket.refillRate)

	if tokensToAdd > 0 {
		bucket.tokens += tokensToAdd
		if bucket.tokens > bucket.capacity {
			bucket.tokens = bucket.capacity
		}
		bucket.lastRefill = now
		r.logger.Debug("Refilled tokens",
			zap.String("user_id", userID),
			zap.String("service", string(service)),
			zap.Int("tokens_added", tokensToAdd),
			zap.Int("current_tokens", bucket.tokens))
	}

	// Check if we have enough tokens
	if bucket.tokens > 0 {
		bucket.tokens--
		r.logger.Debug("Request allowed",
			zap.String("user_id", userID),
			zap.String("service", string(service)),
			zap.Int("remaining_tokens", bucket.tokens))
		return true, 0
	}

	// Calculate retry after time
	retryAfter := bucket.refillRate
	r.logger.Debug("Request denied - rate limit exceeded",
		zap.String("user_id", userID),
		zap.String("service", string(service)),
		zap.Duration("retry_after", retryAfter))

	return false, retryAfter
}

// GetLimit returns the current rate limit for a user and service
func (r *TokenBucketLimiter) GetLimit(ctx context.Context, userID string, service domain.AIService) (int, error) {
	// Default limits
	switch service {
	case domain.AIServiceOpenAI:
		return 20, nil
	case domain.AIServiceClaude:
		return 15, nil
	default:
		return 10, nil
	}
}

// GetUsage returns the current usage (tokens remaining) for a user and service
func (r *TokenBucketLimiter) GetUsage(ctx context.Context, userID string, service domain.AIService) (int, error) {
	key := r.getBucketKey(userID, service)

	r.mu.RLock()
	bucket, exists := r.buckets[key]
	r.mu.RUnlock()

	if !exists {
		return 0, nil
	}

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	return bucket.tokens, nil
}

// Reset resets the rate limit for a user and service
func (r *TokenBucketLimiter) Reset(ctx context.Context, userID string, service domain.AIService) error {
	key := r.getBucketKey(userID, service)

	r.mu.Lock()
	defer r.mu.Unlock()

	if bucket, exists := r.buckets[key]; exists {
		bucket.mu.Lock()
		bucket.tokens = bucket.capacity
		bucket.lastRefill = time.Now()
		bucket.mu.Unlock()

		r.logger.Info("Reset rate limit",
			zap.String("user_id", userID),
			zap.String("service", string(service)))
	}

	return nil
}

// CleanupOldBuckets removes buckets that haven't been used recently
func (r *TokenBucketLimiter) CleanupOldBuckets(maxAge time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	for key, bucket := range r.buckets {
		bucket.mu.Lock()
		if now.Sub(bucket.lastRefill) > maxAge {
			delete(r.buckets, key)
			r.logger.Debug("Cleaned up old token bucket", zap.String("key", key))
		}
		bucket.mu.Unlock()
	}
}

// GetStats returns statistics about the rate limiter
func (r *TokenBucketLimiter) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	stats := make(map[string]interface{})
	stats["total_buckets"] = len(r.buckets)

	bucketsByService := make(map[string]int)
	for key := range r.buckets {
		// Extract service from key (format: "service:userID")
		if parts := strings.SplitN(key, ":", 2); len(parts) > 0 {
			service := parts[0]
			bucketsByService[service]++
		}
	}
	stats["buckets_by_service"] = bucketsByService

	return stats
}

// StartCleanupRoutine starts a background routine to clean up old buckets
func (r *TokenBucketLimiter) StartCleanupRoutine(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				r.CleanupOldBuckets(time.Hour * 24) // Clean up buckets not used for 24 hours
			}
		}
	}()

	r.logger.Info("Started rate limiter cleanup routine",
		zap.Duration("interval", interval))
}
