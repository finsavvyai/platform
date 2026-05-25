//go:build !ignore

package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/render"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"
)

// RateLimitConfig holds configuration for rate limiting
type RateLimitConfig struct {
	// Global requests per second
	GlobalRPS float64

	// Global burst size
	GlobalBurst int

	// Per-IP requests per second
	PerIPRPS float64

	// Per-IP burst size
	PerIPBurst int

	// Per-user requests per second
	PerUserRPS float64

	// Per-user burst size
	PerUserBurst int

	// Per-endpoint rate limits
	EndpointLimits map[string]*EndpointRateLimit

	// Enable sliding window logging
	EnableSlidingWindow bool

	// Cleanup interval
	CleanupInterval time.Duration
}

// EndpointRateLimit defines rate limits for a specific endpoint
type EndpointRateLimit struct {
	Path              string
	Methods           []string
	RequestsPerSecond float64
	Burst             int
}

// DefaultRateLimitConfig returns default rate limit configuration
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		GlobalRPS:           1000,
		GlobalBurst:         2000,
		PerIPRPS:            10,
		PerIPBurst:          20,
		PerUserRPS:          100,
		PerUserBurst:        200,
		EndpointLimits:      getDefaultEndpointLimits(),
		EnableSlidingWindow: false,
		CleanupInterval:     5 * time.Minute,
	}
}

// getDefaultEndpointLimits returns default per-endpoint rate limits
func getDefaultEndpointLimits() map[string]*EndpointRateLimit {
	return map[string]*EndpointRateLimit{
		// Authentication endpoints - stricter limits
		"/api/v1/auth/login": {
			Path:              "/api/v1/auth/login",
			Methods:           []string{"POST"},
			RequestsPerSecond: 1, // 1 request per second
			Burst:             5, // Allow bursts of 5
		},
		"/api/v1/auth/register": {
			Path:              "/api/v1/auth/register",
			Methods:           []string{"POST"},
			RequestsPerSecond: 0.5, // 1 request per 2 seconds
			Burst:             2,
		},
		"/api/v1/auth/reset-password": {
			Path:              "/api/v1/auth/reset-password",
			Methods:           []string{"POST"},
			RequestsPerSecond: 0.2, // 1 request per 5 seconds
			Burst:             1,
		},
		// File upload endpoints
		"/api/v1/files/upload": {
			Path:              "/api/v1/files/upload",
			Methods:           []string{"POST", "PUT"},
			RequestsPerSecond: 2,
			Burst:             5,
		},
		// API query endpoints
		"/api/v1/query": {
			Path:              "/api/v1/query",
			Methods:           []string{"POST"},
			RequestsPerSecond: 5,
			Burst:             10,
		},
		// Admin endpoints - very strict
		"/api/v1/admin": {
			Path:              "/api/v1/admin",
			Methods:           []string{"*"},
			RequestsPerSecond: 5,
			Burst:             10,
		},
	}
}

// RateLimiterMiddleware provides rate limiting with different strategies
type RateLimiterMiddleware struct {
	config           RateLimitConfig
	logger           *logrus.Logger
	globalLimiter    *rate.Limiter
	ipLimiters       map[string]*rateLimiterEntry
	userLimiters     map[string]*rateLimiterEntry
	endpointLimiters map[string]*rate.Limiter
	ipMutex          sync.RWMutex
	userMutex        sync.RWMutex
}

type rateLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// NewRateLimiterMiddleware creates a new rate limiter middleware
func NewRateLimiterMiddleware(config RateLimitConfig, logger *logrus.Logger) *RateLimiterMiddleware {
	if logger == nil {
		logger = logrus.New()
	}

	rlm := &RateLimiterMiddleware{
		config:           config,
		logger:           logger,
		globalLimiter:    rate.NewLimiter(rate.Limit(config.GlobalRPS), config.GlobalBurst),
		ipLimiters:       make(map[string]*rateLimiterEntry),
		userLimiters:     make(map[string]*rateLimiterEntry),
		endpointLimiters: make(map[string]*rate.Limiter),
	}

	// Initialize endpoint limiters
	for path, limit := range config.EndpointLimits {
		rlm.endpointLimiters[path] = rate.NewLimiter(rate.Limit(limit.RequestsPerSecond), limit.Burst)
	}

	// Start cleanup goroutine
	go rlm.cleanup()

	return rlm
}

// Middleware returns the chi middleware function
func (rlm *RateLimiterMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check global rate limit
		if !rlm.globalLimiter.Allow() {
			rlm.rateLimitExceeded(w, r, "GLOBAL", rlm.config.GlobalRPS, rlm.config.GlobalBurst)
			return
		}

		// Get client identifier
		clientID := rlm.getClientID(r)

		// Check IP-based rate limit
		if !rlm.checkIPLimit(clientID) {
			rlm.rateLimitExceeded(w, r, "IP", rlm.config.PerIPRPS, rlm.config.PerIPBurst)
			return
		}

		// Check user-based rate limit (if authenticated)
		if userID := rlm.getUserID(r); userID != "" {
			if !rlm.checkUserLimit(userID) {
				rlm.rateLimitExceeded(w, r, "USER", rlm.config.PerUserRPS, rlm.config.PerUserBurst)
				return
			}
		}

		// Check endpoint-specific rate limit
		if limiter := rlm.getEndpointLimiter(r.URL.Path, r.Method); limiter != nil {
			if !limiter.Allow() {
				rlm.rateLimitExceeded(w, r, "ENDPOINT", 0, 0)
				return
			}
		}

		// Set rate limit headers
		rlm.setRateLimitHeaders(w, clientID)

		next.ServeHTTP(w, r)
	})
}

// getClientID extracts the client ID from the request
func (rlm *RateLimiterMiddleware) getClientID(r *http.Request) string {
	// Try X-Forwarded-For header first
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Try X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// getUserID extracts the user ID from the request context
func (rlm *RateLimiterMiddleware) getUserID(r *http.Request) string {
	// Try to get user ID from context
	if userID := r.Context().Value("user_id"); userID != nil {
		return fmt.Sprintf("%v", userID)
	}

	// Try to get from header (for API key authentication)
	if userID := r.Header.Get("X-User-ID"); userID != "" {
		return userID
	}

	return ""
}

// checkIPLimit checks if the IP has exceeded its rate limit
func (rlm *RateLimiterMiddleware) checkIPLimit(clientID string) bool {
	rlm.ipMutex.Lock()
	defer rlm.ipMutex.Unlock()

	entry, exists := rlm.ipLimiters[clientID]
	if !exists {
		limiter := rate.NewLimiter(rate.Limit(rlm.config.PerIPRPS), rlm.config.PerIPBurst)
		rlm.ipLimiters[clientID] = &rateLimiterEntry{
			limiter:  limiter,
			lastSeen: time.Now(),
		}
		return limiter.Allow()
	}

	entry.lastSeen = time.Now()
	return entry.limiter.Allow()
}

// checkUserLimit checks if the user has exceeded its rate limit
func (rlm *RateLimiterMiddleware) checkUserLimit(userID string) bool {
	rlm.userMutex.Lock()
	defer rlm.userMutex.Unlock()

	entry, exists := rlm.userLimiters[userID]
	if !exists {
		limiter := rate.NewLimiter(rate.Limit(rlm.config.PerUserRPS), rlm.config.PerUserBurst)
		rlm.userLimiters[userID] = &rateLimiterEntry{
			limiter:  limiter,
			lastSeen: time.Now(),
		}
		return limiter.Allow()
	}

	entry.lastSeen = time.Now()
	return entry.limiter.Allow()
}

// getEndpointLimiter gets the rate limiter for a specific endpoint
func (rlm *RateLimiterMiddleware) getEndpointLimiter(path, method string) *rate.Limiter {
	// Check for exact match
	if limiter, exists := rlm.endpointLimiters[path]; exists {
		limit := rlm.config.EndpointLimits[path]
		for _, m := range limit.Methods {
			if m == method || m == "*" {
				return limiter
			}
		}
	}

	// Check for prefix match
	for endpointPath, limiter := range rlm.endpointLimiters {
		if strings.HasPrefix(path, endpointPath) {
			limit := rlm.config.EndpointLimits[endpointPath]
			for _, m := range limit.Methods {
				if m == method || m == "*" {
					return limiter
				}
			}
		}
	}

	return nil
}

// setRateLimitHeaders sets rate limit headers on the response
func (rlm *RateLimiterMiddleware) setRateLimitHeaders(w http.ResponseWriter, clientID string) {
	rlm.ipMutex.RLock()
	_, exists := rlm.ipLimiters[clientID]
	rlm.ipMutex.RUnlock()

	if exists {
		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(int(rlm.config.PerIPRPS)))
		w.Header().Set("X-RateLimit-Remaining", "1") // Simplified
		w.Header().Set("X-RateLimit-Reset", strconv.Itoa(int(time.Now().Add(time.Second).Unix())))
	}
}

// rateLimitExceeded handles rate limit exceeded errors
func (rlm *RateLimiterMiddleware) rateLimitExceeded(w http.ResponseWriter, r *http.Request, limitType string, rps float64, burst int) {
	rlm.logger.WithFields(logrus.Fields{
		"limit_type": limitType,
		"path":       r.URL.Path,
		"method":     r.Method,
		"remote":     r.RemoteAddr,
	}).Warn("Rate limit exceeded")

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Retry-After", "60")
	w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%.0f", rps))
	w.Header().Set("X-RateLimit-Remaining", "0")
	w.Header().Set("X-RateLimit-Reset", strconv.Itoa(int(time.Now().Add(60*time.Second).Unix())))

	w.WriteHeader(http.StatusTooManyRequests)

	render.JSON(w, r, map[string]interface{}{
		"error": map[string]interface{}{
			"code":    "RATE_LIMIT_EXCEEDED",
			"message": fmt.Sprintf("Rate limit exceeded for %s", limitType),
		},
		"meta": map[string]interface{}{
			"limit_type":  limitType,
			"timestamp":   time.Now().UTC().Format(time.RFC3339),
			"retry_after": 60,
		},
	})
}

// cleanup removes stale limiter entries
func (rlm *RateLimiterMiddleware) cleanup() {
	ticker := time.NewTicker(rlm.config.CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rlm.ipMutex.Lock()
		now := time.Now()
		for clientID, entry := range rlm.ipLimiters {
			if now.Sub(entry.lastSeen) > rlm.config.CleanupInterval*2 {
				delete(rlm.ipLimiters, clientID)
			}
		}
		rlm.ipMutex.Unlock()

		rlm.userMutex.Lock()
		for userID, entry := range rlm.userLimiters {
			if now.Sub(entry.lastSeen) > rlm.config.CleanupInterval*2 {
				delete(rlm.userLimiters, userID)
			}
		}
		rlm.userMutex.Unlock()
	}
}

// RateLimiterMiddlewareFunc is a convenience function that creates
// a middleware with default rate limit configuration
func RateLimiterMiddlewareFunc() func(http.Handler) http.Handler {
	rlm := NewRateLimiterMiddleware(DefaultRateLimitConfig(), nil)
	return rlm.Middleware
}

// PerEndpointRateLimiter creates a rate limiter for specific endpoints
// This can be used in route definitions for more granular control
func PerEndpointRateLimiter(requestsPerSecond float64, burst int) func(http.Handler) http.Handler {
	limiter := rate.NewLimiter(rate.Limit(requestsPerSecond), burst)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !limiter.Allow() {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "60")
				w.WriteHeader(http.StatusTooManyRequests)

				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "RATE_LIMIT_EXCEEDED",
						"message": "Too many requests",
					},
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// SlidingWindowRateLimiter provides sliding window rate limiting
type SlidingWindowRateLimiter struct {
	requests map[string][]time.Time
	maxReqs  int
	window   time.Duration
	mutex    sync.RWMutex
}

// NewSlidingWindowRateLimiter creates a new sliding window rate limiter
func NewSlidingWindowRateLimiter(maxRequests int, window time.Duration) *SlidingWindowRateLimiter {
	return &SlidingWindowRateLimiter{
		requests: make(map[string][]time.Time),
		maxReqs:  maxRequests,
		window:   window,
	}
}

// Allow checks if a request is allowed under the rate limit
func (sw *SlidingWindowRateLimiter) Allow(key string) bool {
	sw.mutex.Lock()
	defer sw.mutex.Unlock()

	now := time.Now()
	windowStart := now.Add(-sw.window)

	// Get existing requests for this key
	reqs, exists := sw.requests[key]
	if !exists {
		sw.requests[key] = []time.Time{now}
		return true
	}

	// Remove requests outside the window
	validReqs := make([]time.Time, 0, len(reqs))
	for _, req := range reqs {
		if req.After(windowStart) {
			validReqs = append(validReqs, req)
		}
	}

	// Check if limit exceeded
	if len(validReqs) >= sw.maxReqs {
		return false
	}

	// Add current request
	validReqs = append(validReqs, now)
	sw.requests[key] = validReqs

	return true
}

// SlidingWindowMiddleware creates a middleware using sliding window rate limiting
func SlidingWindowMiddleware(maxRequests int, window time.Duration) func(http.Handler) http.Handler {
	limiter := NewSlidingWindowRateLimiter(maxRequests, window)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.RemoteAddr

			if !limiter.Allow(key) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
				w.WriteHeader(http.StatusTooManyRequests)

				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "RATE_LIMIT_EXCEEDED",
						"message": fmt.Sprintf("Too many requests (max %d per %s)", maxRequests, window),
					},
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
