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

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/storage"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/cache"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/policy"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/abuse"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/security"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/queue"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/metrics"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
)

// AdvancedRateLimitMiddleware creates a comprehensive rate limiting middleware
func AdvancedRateLimitMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	logger := logrus.WithField("middleware", "advanced_rate_limit")

	// Initialize components
	kvStore, err := storage.NewCloudflareKVStore(
		cfg.Cloudflare.APIToken,
		cfg.Cloudflare.AccountID,
		cfg.Cloudflare.KVNamespace,
		logger,
	)
	if err != nil {
		logger.WithError(err).Fatal("Failed to initialize Cloudflare KV store")
	}

	rateLimitCache := cache.NewRateLimitCache(logger)

	policyStorage := &policy.MemoryPolicyStorage{} // Would implement actual storage
	policyManager, err := policy.NewRateLimitPolicyManager(policyStorage, logger)
	if err != nil {
		logger.WithError(err).Fatal("Failed to initialize policy manager")
	}

	// Load default policies
	if err := policyManager.LoadDefaultPolicies(); err != nil {
		logger.WithError(err).Error("Failed to load default policies")
	}

	metricsCollector := metrics.NewRateLimitMetricsCollector(
		&metrics.MetricsConfig{
			Enabled:           true,
			RetentionPeriod:   time.Hour * 24,
			ScrapeInterval:    time.Second * 10,
			TimeSeriesEnabled: true,
			RealtimeEnabled:   true,
			AlertsEnabled:     true,
			PrometheusEnabled: true,
			ExportInterval:    time.Minute * 5,
		},
		nil, // Would implement actual storage
		logger,
	)

	abuseStorage := &abuse.MemoryAbuseStorage{} // Would implement actual storage
	abuseDetector := abuse.NewAbuseDetector(abuseStorage, logger)

	blockStorage := &security.MemoryBlockStorage{} // Would implement actual storage
	ipBlocker := security.NewIPBlocker(blockStorage, logger, true)

	rateLimiter := services.NewRateLimiter(
		cfg,
		kvStore,
		rateLimitCache,
		policyManager,
		metricsCollector,
		abuseDetector,
		ipBlocker,
		logger,
	)

	queueConfig := &queue.QueueConfig{
		DefaultSize:        1000,
		MaxSize:           10000,
		DefaultTimeout:    time.Minute * 5,
		MaxTimeout:        time.Hour,
		BatchSize:         50,
		ProcessingDelay:   time.Millisecond * 100,
		RetryAttempts:     3,
		RetryDelay:        time.Second,
		PriorityLevels:    5,
		EnablePersistence: false,
	}

	queueStorage := &queue.MemoryQueueStorage{} // Would implement actual storage
	burstQueue := queue.NewBurstQueue(queueConfig, queueStorage, logger)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip rate limiting for health checks and metrics
			if isPublicPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			// Create rate limit request
			rateLimitReq := &services.RateLimitRequest{
				Key:       extractRateLimitKey(r),
				TenantID:  extractTenantID(r),
				UserID:    extractUserID(r),
				IPAddress: extractIPAddress(r),
				Endpoint:  r.URL.Path,
				Method:    r.Method,
				Headers:   extractHeaders(r),
				Timestamp: time.Now(),
				Weight:    1,
				Burst:     false,
			}

			// Check rate limit
			result, err := rateLimiter.CheckRateLimit(r.Context(), rateLimitReq)
			if err != nil {
				logger.WithError(err).Error("Rate limit check failed")
				// Continue with request on error
				next.ServeHTTP(w, r)
				return
			}

			// Add rate limiting headers
			addRateLimitHeadersToResponse(w, result)

			// Handle rate limit exceeded
			if !result.Allowed {
				logger.WithFields(logrus.Fields{
					"key":        rateLimitReq.Key,
					"tenant_id":  rateLimitReq.TenantID,
					"endpoint":   rateLimitReq.Endpoint,
					"reason":     "rate_limited",
					"retry_after": result.RetryAfter,
				}).Info("Request blocked by rate limiter")

				// Set Retry-After header if available
				if result.RetryAfter > 0 {
					w.Header().Set("Retry-After", strconv.Itoa(int(result.RetryAfter.Seconds())))
				}

				// Check if we should queue the request
				if result.PolicyApplied != nil && result.PolicyApplied.QueueEnabled {
					// Convert HTTP request to queued request
					queuedReq := &queue.QueuedRequest{
						ID:           generateRequestID(),
						Method:       r.Method,
						URL:          r.URL.String(),
						Headers:      extractHeaders(r),
						RemoteAddr:   r.RemoteAddr,
						UserAgent:    r.UserAgent(),
						TenantID:     rateLimitReq.TenantID,
						UserID:       rateLimitReq.UserID,
						Timeout:      time.Second * 30,
						Weight:       rateLimitReq.Weight,
						OriginalTime: time.Now(),
					}

					// Enqueue request
					enqueueResult, err := burstQueue.EnqueueRequest(r.Context(), queuedReq, 1)
					if err == nil && enqueueResult.Success {
						// Return 202 Accepted for queued requests
						w.Header().Set("X-Queue-ID", enqueueResult.QueueID)
						w.Header().Set("X-Queue-Position", strconv.Itoa(enqueueResult.Position))
						w.Header().Set("X-Queue-Wait-Time", enqueueResult.WaitTime.String())

						render.Status(r, http.StatusAccepted)
						render.JSON(w, r, map[string]interface{}{
							"success": true,
							"message": "Request queued for processing",
							"queue": map[string]interface{}{
								"id":        enqueueResult.QueueID,
								"position":  enqueueResult.Position,
								"wait_time": enqueueResult.WaitTime.String(),
							},
							"meta": map[string]interface{}{
								"timestamp": time.Now().UTC().Format(time.RFC3339),
							},
						})
						return
					}
				}

				// Return 429 Too Many Requests
				render.Status(r, http.StatusTooManyRequests)
				render.JSON(w, r, map[string]interface{}{
					"success": false,
					"error": map[string]interface{}{
						"code":    "RATE_LIMIT_EXCEEDED",
						"message": "Rate limit exceeded",
						"details": map[string]interface{}{
							"limit":         result.Limit,
							"remaining":     result.Remaining,
							"reset_time":    result.ResetTime.Format(time.RFC3339),
							"retry_after":   result.RetryAfter.String(),
							"policy":        result.PolicyApplied.Name,
						},
					},
					"meta": map[string]interface{}{
						"timestamp": time.Now().UTC().Format(time.RFC3339),
					},
				})
				return
			}

			// Check if IP is blocked
			if rateLimitReq.IPAddress != "" {
				blockInfo, err := ipBlocker.IsBlocked(r.Context(), rateLimitReq.IPAddress)
				if err == nil && blockInfo != nil {
					logger.WithFields(logrus.Fields{
						"ip_address": rateLimitReq.IPAddress,
						"reason":     blockInfo.Reason,
						"block_type": blockInfo.BlockType,
					}).Warn("Request from blocked IP rejected")

					w.Header().Set("X-IP-Blocked", "true")
					w.Header().Set("X-IP-Block-Reason", blockInfo.Reason)
					w.Header().Set("X-IP-Block-Expires", blockInfo.ExpiresAt.Format(time.RFC3339))

					render.Status(r, http.StatusForbidden)
					render.JSON(w, r, map[string]interface{}{
						"success": false,
						"error": map[string]interface{}{
							"code":    "IP_BLOCKED",
							"message": "Your IP address has been blocked",
							"details": map[string]interface{}{
								"reason":     blockInfo.Reason,
								"block_type": blockInfo.BlockType,
								"expires_at": blockInfo.ExpiresAt.Format(time.RFC3339),
							},
						},
						"meta": map[string]interface{}{
							"timestamp": time.Now().UTC().Format(time.RFC3339),
						},
					})
					return
				}
			}

			// Check quota if applicable
			if rateLimitReq.TenantID != "" {
				quotaReq := &services.QuotaRequest{
					TenantID:     rateLimitReq.TenantID,
					UserID:       rateLimitReq.UserID,
					ResourceType: "api_requests",
					Amount:       1,
					Metadata: map[string]string{
						"endpoint": rateLimitReq.Endpoint,
						"method":   rateLimitReq.Method,
					},
					Timestamp: time.Now(),
				}

				quotaResult, err := rateLimiter.ConsumeQuota(r.Context(), quotaReq)
				if err != nil {
					logger.WithError(err).Error("Quota check failed")
					// Continue with request on error
				} else if !quotaResult.Success {
					addQuotaHeadersToResponse(w, quotaResult)

					logger.WithFields(logrus.Fields{
						"tenant_id":     quotaReq.TenantID,
						"resource_type": quotaReq.ResourceType,
						"amount":        quotaResult.Consumed,
						"limit":         quotaResult.Limit,
					}).Info("Quota limit exceeded")

					render.Status(r, http.StatusPaymentRequired)
					render.JSON(w, r, map[string]interface{}{
						"success": false,
						"error": map[string]interface{}{
							"code":    "QUOTA_EXCEEDED",
							"message": "Quota limit exceeded",
							"details": map[string]interface{}{
								"resource_type": quotaResult.ResourceType,
								"consumed":      quotaResult.Consumed,
								"limit":         quotaResult.Limit,
								"remaining":     quotaResult.Remaining,
								"reset_time":    quotaResult.ResetTime.Format(time.RFC3339),
							},
						},
						"meta": map[string]interface{}{
							"timestamp": time.Now().UTC().Format(time.RFC3339),
						},
					})
					return
				}

				addQuotaHeadersToResponse(w, quotaResult)
			}

			// Request is allowed, continue processing
			next.ServeHTTP(w, r)
		})
	}
}

// QuotaMiddleware specifically handles quota enforcement
func QuotaMiddleware(rateLimiter services.RateLimiterService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip quota checks for health checks and metrics
			if isPublicPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			tenantID := extractTenantID(r)
			if tenantID == "" {
				// No tenant ID, skip quota check
				next.ServeHTTP(w, r)
				return
			}

			// Create quota request
			quotaReq := &services.QuotaRequest{
				TenantID:     tenantID,
				UserID:       extractUserID(r),
				ResourceType: "api_requests",
				Amount:       1,
				Metadata: map[string]string{
					"endpoint": r.URL.Path,
					"method":   r.Method,
					"user_agent": r.UserAgent(),
				},
				Timestamp: time.Now(),
			}

			// Check and consume quota
			result, err := rateLimiter.ConsumeQuota(r.Context(), quotaReq)
			if err != nil {
				logrus.WithError(err).Error("Quota check failed")
				// Continue with request on error
				next.ServeHTTP(w, r)
				return
			}

			// Add quota headers
			addQuotaHeadersToResponse(w, result)

			if !result.Success {
				logrus.WithFields(logrus.Fields{
					"tenant_id":     tenantID,
					"resource_type": quotaReq.ResourceType,
					"consumed":      result.Consumed,
					"limit":         result.Limit,
				}).Info("Quota limit exceeded")

				render.Status(r, http.StatusPaymentRequired)
				render.JSON(w, r, map[string]interface{}{
					"success": false,
					"error": map[string]interface{}{
						"code":    "QUOTA_EXCEEDED",
						"message": "Quota limit exceeded. Please upgrade your plan or wait for quota reset.",
						"details": map[string]interface{}{
							"resource_type": quotaReq.ResourceType,
							"consumed":      result.Consumed,
							"limit":         result.Limit,
							"remaining":     result.Remaining,
							"reset_time":    result.ResetTime.Format(time.RFC3339),
						},
					},
					"meta": map[string]interface{}{
						"timestamp": time.Now().UTC().Format(time.RFC3339),
					},
				})
				return
			}

			// Quota available, continue processing
			next.ServeHTTP(w, r)
		})
	}
}

// Helper functions

func extractRateLimitKey(r *http.Request) string {
	// Priority: User ID > API Key > IP Address
	if userID := extractUserID(r); userID != "" {
		return userID
	}

	if apiKey := r.Header.Get("X-API-Key"); apiKey != "" {
		return "api_key:" + apiKey
	}

	return "ip:" + extractIPAddress(r)
}

func extractTenantID(r *http.Request) string {
	if tenantID := r.Header.Get("X-Tenant-ID"); tenantID != "" {
		return tenantID
	}

	// Extract from context if available
	if tenantID := r.Context().Value("tenant_id"); tenantID != nil {
		if tid, ok := tenantID.(string); ok {
			return tid
		}
	}

	return ""
}

func extractUserID(r *http.Request) string {
	// Extract from context if available
	if userID := r.Context().Value("user_id"); userID != nil {
		if uid, ok := userID.(string); ok {
			return uid
		}
	}

	return ""
}

func extractIPAddress(r *http.Request) string {
	// Check for forwarded IP addresses first
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}

	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		// Take the first IP in the list
		for idx := 0; idx < len(ip); idx++ {
			if ip[idx] == ',' {
				return ip[:idx]
			}
		}
		return ip
	}

	return r.RemoteAddr
}

func extractHeaders(r *http.Request) map[string]string {
	headers := make(map[string]string)
	for name, values := range r.Header {
		if len(values) > 0 {
			headers[name] = values[0]
		}
	}
	return headers
}

func generateRequestID() string {
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}

func addRateLimitHeadersToResponse(w http.ResponseWriter, result *services.RateLimitResult) {
	if result == nil {
		return
	}

	w.Header().Set("X-RateLimit-Limit", strconv.Itoa(result.Limit))
	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(result.Remaining))
	w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(result.ResetTime.Unix(), 10))

	if result.RetryAfter > 0 {
		w.Header().Set("X-RateLimit-Retry-After", result.RetryAfter.String())
	}

	if result.PolicyApplied != nil {
		w.Header().Set("X-RateLimit-Policy", result.PolicyApplied.Name)
		w.Header().Set("X-RateLimit-Policy-ID", result.PolicyApplied.ID)
	}
}

func addQuotaHeadersToResponse(w http.ResponseWriter, result *services.QuotaResult) {
	if result == nil {
		return
	}

	w.Header().Set("X-Quota-Limit", strconv.FormatInt(result.Limit, 10))
	w.Header().Set("X-Quota-Remaining", strconv.FormatInt(result.Remaining, 10))
	w.Header().Set("X-Quota-Reset", strconv.FormatInt(result.ResetTime.Unix(), 10))
	w.Header().Set("X-Quota-Consumed", strconv.FormatInt(result.Consumed, 10))

	if result.ExceededLimit {
		w.Header().Set("X-Quota-Exceeded", "true")
	}
}
