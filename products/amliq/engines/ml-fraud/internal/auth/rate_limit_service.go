package auth

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"quantumbeam/internal/interfaces"
)

// RateLimitService implements rate limiting functionality using Redis
type RateLimitService struct {
	redisClient *redis.Client
}

// NewRateLimitService creates a new rate limiting service
func NewRateLimitService(redisClient *redis.Client) *RateLimitService {
	return &RateLimitService{
		redisClient: redisClient,
	}
}

// CheckRateLimit checks if a request is within rate limits
func (r *RateLimitService) CheckRateLimit(ctx context.Context, key string, limit int, windowSeconds int) (*interfaces.RateLimitResult, error) {
	now := time.Now()
	windowStart := now.Truncate(time.Duration(windowSeconds) * time.Second)
	windowEnd := windowStart.Add(time.Duration(windowSeconds) * time.Second)

	// Use Redis pipeline for atomic operations
	pipe := r.redisClient.Pipeline()

	// Get current count
	countCmd := pipe.Get(ctx, key)

	// Set expiration if key doesn't exist
	pipe.SetNX(ctx, key, 0, time.Duration(windowSeconds)*time.Second)

	// Execute pipeline
	_, err := pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		return nil, fmt.Errorf("failed to check rate limit: %w", err)
	}

	// Get current count
	currentStr, err := countCmd.Result()
	current := 0
	if err == nil {
		current, _ = strconv.Atoi(currentStr)
	}

	// Check if limit exceeded
	allowed := current < limit
	remaining := limit - current - 1
	if remaining < 0 {
		remaining = 0
	}

	resetTime := windowEnd.Unix()
	retryAfter := 0
	if !allowed {
		retryAfter = int(windowEnd.Sub(now).Seconds())
	}

	return &interfaces.RateLimitResult{
		Allowed:    allowed,
		Remaining:  remaining,
		ResetTime:  resetTime,
		RetryAfter: retryAfter,
	}, nil
}

// IncrementCounter increments the rate limit counter
func (r *RateLimitService) IncrementCounter(ctx context.Context, key string, windowSeconds int) error {
	// Increment counter with expiration
	pipe := r.redisClient.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, time.Duration(windowSeconds)*time.Second)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to increment counter: %w", err)
	}

	return nil
}

// GetRateLimitStatus gets the current rate limit status
func (r *RateLimitService) GetRateLimitStatus(ctx context.Context, key string) (*interfaces.RateLimitStatus, error) {
	// Get current count and TTL
	pipe := r.redisClient.Pipeline()
	countCmd := pipe.Get(ctx, key)
	ttlCmd := pipe.TTL(ctx, key)

	_, err := pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		return nil, fmt.Errorf("failed to get rate limit status: %w", err)
	}

	currentStr, _ := countCmd.Result()
	current, _ := strconv.Atoi(currentStr)

	ttl, _ := ttlCmd.Result()
	now := time.Now()
	resetTime := now.Add(ttl).Unix()

	return &interfaces.RateLimitStatus{
		Key:         key,
		Current:     current,
		Limit:       0, // This would need to be passed in or stored separately
		WindowStart: now.Add(-ttl).Unix(),
		WindowEnd:   resetTime,
		ResetTime:   resetTime,
	}, nil
}

// ResetRateLimit resets the rate limit counter for a key
func (r *RateLimitService) ResetRateLimit(ctx context.Context, key string) error {
	err := r.redisClient.Del(ctx, key).Err()
	if err != nil {
		return fmt.Errorf("failed to reset rate limit: %w", err)
	}

	return nil
}

// SlidingWindowRateLimit implements sliding window rate limiting
func (r *RateLimitService) SlidingWindowRateLimit(ctx context.Context, key string, limit int, windowSeconds int) (*interfaces.RateLimitResult, error) {
	now := time.Now()
	windowStart := now.Add(-time.Duration(windowSeconds) * time.Second)

	// Use sorted set to track requests in sliding window
	pipe := r.redisClient.Pipeline()

	// Remove old entries
	pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart.UnixNano()))

	// Count current entries
	countCmd := pipe.ZCard(ctx, key)

	// Execute pipeline
	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check sliding window rate limit: %w", err)
	}

	current, err := countCmd.Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get current count: %w", err)
	}

	allowed := int(current) < limit
	remaining := limit - int(current) - 1
	if remaining < 0 {
		remaining = 0
	}

	resetTime := now.Add(time.Duration(windowSeconds) * time.Second).Unix()
	retryAfter := 0
	if !allowed {
		retryAfter = windowSeconds
	}

	return &interfaces.RateLimitResult{
		Allowed:    allowed,
		Remaining:  remaining,
		ResetTime:  resetTime,
		RetryAfter: retryAfter,
	}, nil
}

// IncrementSlidingWindow increments the sliding window counter
func (r *RateLimitService) IncrementSlidingWindow(ctx context.Context, key string, windowSeconds int) error {
	now := time.Now()

	// Add current request to sorted set
	pipe := r.redisClient.Pipeline()
	pipe.ZAdd(ctx, key, redis.Z{
		Score:  float64(now.UnixNano()),
		Member: fmt.Sprintf("%d", now.UnixNano()),
	})

	// Set expiration
	pipe.Expire(ctx, key, time.Duration(windowSeconds)*time.Second)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to increment sliding window: %w", err)
	}

	return nil
}

// BruteForceProtection implements brute force protection
func (r *RateLimitService) BruteForceProtection(ctx context.Context, identifier string, maxAttempts int, blockDurationSeconds int) (*interfaces.RateLimitResult, error) {
	key := fmt.Sprintf("brute_force:%s", identifier)

	result, err := r.CheckRateLimit(ctx, key, maxAttempts, blockDurationSeconds)
	if err != nil {
		return nil, fmt.Errorf("failed to check brute force protection: %w", err)
	}

	return result, nil
}

// RecordFailedAttempt records a failed authentication attempt
func (r *RateLimitService) RecordFailedAttempt(ctx context.Context, identifier string, blockDurationSeconds int) error {
	key := fmt.Sprintf("brute_force:%s", identifier)

	err := r.IncrementCounter(ctx, key, blockDurationSeconds)
	if err != nil {
		return fmt.Errorf("failed to record failed attempt: %w", err)
	}

	return nil
}

// ClearFailedAttempts clears failed attempts for an identifier
func (r *RateLimitService) ClearFailedAttempts(ctx context.Context, identifier string) error {
	key := fmt.Sprintf("brute_force:%s", identifier)

	err := r.ResetRateLimit(ctx, key)
	if err != nil {
		return fmt.Errorf("failed to clear failed attempts: %w", err)
	}

	return nil
}
