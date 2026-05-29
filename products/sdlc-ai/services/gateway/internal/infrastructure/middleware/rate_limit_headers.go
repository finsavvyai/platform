//go:build ignore

package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/render"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

// RateLimitHeadersMiddleware adds rate limiting headers to responses
func RateLimitHeadersMiddleware(rateLimiter services.RateLimiterService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip for health checks and metrics
			if isPublicPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			// Create a response writer wrapper to capture status code
			wrapped := &responseWriterWithHeaders{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
				headers:        make(map[string]string),
			}

			// Process request
			next.ServeHTTP(wrapped, r)

			// Add rate limiting headers based on request
			if err := addRateLimitHeaders(r.Context(), wrapped, r, rateLimiter); err != nil {
				logrus.WithError(err).Error("Failed to add rate limiting headers")
			}

			// Copy headers to actual response
			for key, value := range wrapped.headers {
				w.Header().Set(key, value)
			}
		})
	}
}

// RateLimitInfoMiddleware provides rate limit information endpoint
func RateLimitInfoMiddleware(rateLimiter services.RateLimiterService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract rate limit key from request
		key := extractRateLimitKey(r)
		if key == "" {
			render.Status(r, http.StatusBadRequest)
			render.JSON(w, r, map[string]interface{}{
				"error": map[string]interface{}{
					"code":    "MISSING_RATE_LIMIT_KEY",
					"message": "Unable to determine rate limit key",
				},
			})
			return
		}

		// Get rate limit info
		rateLimitInfo, err := rateLimiter.GetRateLimitInfo(r.Context(), key)
		if err != nil {
			logrus.WithError(err).Error("Failed to get rate limit info")
			render.Status(r, http.StatusInternalServerError)
			render.JSON(w, r, map[string]interface{}{
				"error": map[string]interface{}{
					"code":    "RATE_LIMIT_INFO_ERROR",
					"message": "Failed to retrieve rate limit information",
				},
			})
			return
		}

		// Add rate limiting headers
		if err := addRateLimitHeadersToResponse(w, rateLimitInfo); err != nil {
			logrus.WithError(err).Error("Failed to add rate limit headers to info response")
		}

		// Return rate limit information
		render.Status(r, http.StatusOK)
		render.JSON(w, r, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"rate_limit_info": rateLimitInfo,
				"timestamp":       time.Now().UTC().Format(time.RFC3339),
			},
		})
	}
}

// QuotaInfoMiddleware provides quota information endpoint
func QuotaInfoMiddleware(rateLimiter services.RateLimiterService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract tenant ID from request
		tenantID := extractTenantID(r)
		if tenantID == "" {
			render.Status(r, http.StatusBadRequest)
			render.JSON(w, r, map[string]interface{}{
				"error": map[string]interface{}{
					"code":    "MISSING_TENANT_ID",
					"message": "Unable to determine tenant ID",
				},
			})
			return
		}

		// Get quota info
		quotaInfo, err := rateLimiter.GetQuotaInfo(r.Context(), tenantID)
		if err != nil {
			logrus.WithError(err).Error("Failed to get quota info")
			render.Status(r, http.StatusInternalServerError)
			render.JSON(w, r, map[string]interface{}{
				"error": map[string]interface{}{
					"code":    "QUOTA_INFO_ERROR",
					"message": "Failed to retrieve quota information",
				},
			})
			return
		}

		// Add quota headers
		if err := addQuotaHeadersToResponse(w, quotaInfo); err != nil {
			logrus.WithError(err).Error("Failed to add quota headers to info response")
		}

		// Return quota information
		render.Status(r, http.StatusOK)
		render.JSON(w, r, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"quota_info": quotaInfo,
				"timestamp":  time.Now().UTC().Format(time.RFC3339),
			},
		})
	}
}

// RateLimitMetricsMiddleware provides metrics endpoint
func RateLimitMetricsMiddleware(rateLimiter services.RateLimiterService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get rate limiting metrics
		metrics := rateLimiter.GetMetrics()

		// Return metrics
		render.Status(r, http.StatusOK)
		render.JSON(w, r, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"metrics":   metrics,
				"timestamp": time.Now().UTC().Format(time.RFC3339),
			},
		})
	}
}

// Helper types and functions

type responseWriterWithHeaders struct {
	http.ResponseWriter
	statusCode int
	headers    map[string]string
}

func (rwwh *responseWriterWithHeaders) WriteHeader(code int) {
	rwwh.statusCode = code
	// Add headers before writing actual headers
	for key, value := range rwwh.headers {
		rwwh.ResponseWriter.Header().Set(key, value)
	}
	rwwh.ResponseWriter.WriteHeader(code)
}

func (rwwh *responseWriterWithHeaders) Header() http.Header {
	return rwwh.ResponseWriter.Header()
}

func (rwwh *responseWriterWithHeaders) Write(b []byte) (int, error) {
	// Ensure headers are set before first write
	if rwwh.statusCode == http.StatusOK {
		rwwh.WriteHeader(http.StatusOK)
	}
	return rwwh.ResponseWriter.Write(b)
}

func addRateLimitHeaders(ctx context.Context, w *responseWriterWithHeaders, r *http.Request, rateLimiter services.RateLimiterService) error {
	// Extract rate limit key from request
	key := extractRateLimitKey(r)
	if key == "" {
		return nil // No key, no headers
	}

	// Get rate limit info
	rateLimitInfo, err := rateLimiter.GetRateLimitInfo(ctx, key)
	if err != nil {
		return fmt.Errorf("failed to get rate limit info: %w", err)
	}

	return addRateLimitHeadersToResponse(w, rateLimitInfo)
}

func addRateLimitHeadersToResponse(w http.ResponseWriter, rateLimitInfo *services.RateLimitInfo) error {
	if rateLimitInfo == nil {
		return nil
	}

	// Find the most restrictive limit (lowest remaining)
	var mostRestrictive *services.LimitStatus
	for _, limit := range rateLimitInfo.Limits {
		if mostRestrictive == nil || limit.Remaining < mostRestrictive.Remaining {
			mostRestrictive = &limit
		}
	}

	if mostRestrictive != nil {
		// Standard rate limiting headers
		w.Header().Set("X-RateLimit-Limit", strconv.FormatInt(mostRestrictive.Limit, 10))
		w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(mostRestrictive.Remaining, 10))
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(mostRestrictive.ResetTime.Unix(), 10))
		w.Header().Set("X-RateLimit-Reset-After", strconv.FormatInt(int(mostRestrictive.ResetTime.Sub(time.Now()).Seconds()), 10))

		// Burst capacity headers
		w.Header().Set("X-RateLimit-Burst-Limit", strconv.FormatInt(mostRestrictive.BurstRemaining, 10))
		w.Header().Set("X-RateLimit-Burst-Remaining", strconv.FormatInt(mostRestrictive.BurstRemaining, 10))

		// Window information
		w.Header().Set("X-RateLimit-Window", mostRestrictive.Window.String())
		w.Header().Set("X-RateLimit-Window-Remaining", strconv.FormatInt(int(mostRestrictive.ResetTime.Sub(time.Now()).Milliseconds()), 10))

		// Policy information
		if len(rateLimitInfo.Policies) > 0 {
			w.Header().Set("X-RateLimit-Policy", rateLimitInfo.Policies[0])
		}

		// Additional headers for rate limit type
		w.Header().Set("X-RateLimit-Type", mostRestrictive.Type)
	}

	// Block information if blocked
	if rateLimitInfo.Blocked && rateLimitInfo.BlockInfo != nil {
		w.Header().Set("X-RateLimit-Blocked", "true")
		w.Header().Set("X-RateLimit-Block-Reason", rateLimitInfo.BlockInfo.Reason)
		w.Header().Set("X-RateLimit-Block-Expires", strconv.FormatInt(rateLimitInfo.BlockInfo.ExpiresAt.Unix(), 10))
		w.Header().Set("X-RateLimit-Block-Type", rateLimitInfo.BlockInfo.BlockType)
		w.Header().Set("X-RateLimit-Block-Severity", rateLimitInfo.BlockInfo.Severity)

		// Add Retry-After header for blocked requests
		if w.(*responseWriterWithHeaders).statusCode == http.StatusTooManyRequests {
			retryAfter := int(rateLimitInfo.BlockInfo.ExpiresAt.Sub(time.Now()).Seconds())
			if retryAfter > 0 {
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			}
		}
	}

	// Add cache control headers for rate limit info
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	return nil
}

func addQuotaHeadersToResponse(w http.ResponseWriter, quotaInfo *services.QuotaInfo) error {
	if quotaInfo == nil {
		return nil
	}

	// Add quota headers for each resource type
	for resourceType, quota := range quotaInfo.Quotas {
		// Create header names based on resource type
		limitHeader := fmt.Sprintf("X-Quota-%s-Limit", normalizeHeaderName(resourceType))
		remainingHeader := fmt.Sprintf("X-Quota-%s-Remaining", normalizeHeaderName(resourceType))
		resetHeader := fmt.Sprintf("X-Quota-%s-Reset", normalizeHeaderName(resourceType))
		periodHeader := fmt.Sprintf("X-Quota-%s-Period", normalizeHeaderName(resourceType))

		w.Header().Set(limitHeader, strconv.FormatInt(quota.Limit, 10))
		w.Header().Set(remainingHeader, strconv.FormatInt(quota.Remaining, 10))
		w.Header().Set(resetHeader, strconv.FormatInt(quota.ResetTime.Unix(), 10))
		w.Header().Set(periodHeader, quota.Period.String())
	}

	// Add overall quota information
	w.Header().Set("X-Quota-Last-Updated", quotaInfo.LastUpdated.Format(time.RFC3339))

	return nil
}

func extractRateLimitKey(r *http.Request) string {
	// Try to extract user ID from context (would be set by auth middleware)
	if userID := r.Context().Value("user_id"); userID != nil {
		if uid, ok := userID.(string); ok {
			return uid
		}
	}

	// Try to extract API key from headers
	if apiKey := r.Header.Get("X-API-Key"); apiKey != "" {
		return fmt.Sprintf("api_key:%s", apiKey)
	}

	// Fall back to IP address
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return fmt.Sprintf("ip:%s", ip)
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		// Take the first IP in the list
		if idx := strings.Index(ip, ","); idx != -1 {
			ip = ip[:idx]
		}
		return fmt.Sprintf("ip:%s", strings.TrimSpace(ip))
	}

	return fmt.Sprintf("ip:%s", r.RemoteAddr)
}

func extractTenantID(r *http.Request) string {
	// Try to extract tenant ID from context
	if tenantID := r.Context().Value("tenant_id"); tenantID != nil {
		if tid, ok := tenantID.(string); ok {
			return tid
		}
	}

	// Try to extract from headers
	if tenantID := r.Header.Get("X-Tenant-ID"); tenantID != "" {
		return tenantID
	}

	// Try to extract from JWT token (simplified)
	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		// In a real implementation, you would parse the JWT token
		// and extract the tenant_id claim
		return ""
	}

	return ""
}

func normalizeHeaderName(name string) string {
	// Convert resource type to a valid header name format
	// Replace non-alphanumeric characters with hyphens
	result := ""
	for _, char := range name {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') {
			result += string(char)
		} else {
			result += "-"
		}
	}
	return result
}

// RateLimitHealthMiddleware provides health check for rate limiting service
func RateLimitHealthMiddleware(rateLimiter services.RateLimiterService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Test rate limiter by checking a dummy key
		testKey := "health_check_test"
		_, err := rateLimiter.GetRateLimitInfo(ctx, testKey)
		if err != nil {
			logrus.WithError(err).Error("Rate limiter health check failed")
			render.Status(r, http.StatusServiceUnavailable)
			render.JSON(w, r, map[string]interface{}{
				"status": "unhealthy",
				"error":  err.Error(),
			})
			return
		}

		// Get metrics as additional health indicator
		metrics := rateLimiter.GetMetrics()

		render.Status(r, http.StatusOK)
		render.JSON(w, r, map[string]interface{}{
			"status":    "healthy",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"metrics": map[string]interface{}{
				"total_requests":   metrics.TotalRequests,
				"allowed_requests": metrics.AllowedRequests,
				"blocked_requests": metrics.BlockedRequests,
				"cache_hit_rate":   metrics.CacheHitRate,
				"average_latency":  metrics.AverageLatency.String(),
			},
		})
	}
}

// RateLimitConfigMiddleware returns rate limiting configuration
func RateLimitConfigMiddleware(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		config := map[string]interface{}{
			"rate_limit": map[string]interface{}{
				"requests": cfg.RateLimit.Requests,
				"window":   cfg.RateLimit.Window.String(),
				"burst":    cfg.RateLimit.Burst,
			},
			"security": map[string]interface{}{
				"rate_limiting": map[string]interface{}{
					"enabled":            cfg.Security.RateLimiting.Enabled,
					"default_rate_limit": cfg.Security.RateLimiting.DefaultRateLimit,
					"default_window":     cfg.Security.RateLimiting.DefaultWindow.String(),
					"burst_limit":        cfg.Security.RateLimiting.BurstLimit,
					"redis_key_prefix":   cfg.Security.RateLimiting.RedisKeyPrefix,
					"cleanup_interval":   cfg.Security.RateLimiting.CleanupInterval.String(),
				},
			},
		}

		render.Status(r, http.StatusOK)
		render.JSON(w, r, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"config":    config,
				"timestamp": time.Now().UTC().Format(time.RFC3339),
			},
		})
	}
}
