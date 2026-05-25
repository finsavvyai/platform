package auth

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"quantumbeam/internal/models"
)

// APIKeyMiddleware provides API key specific middleware functionality
type APIKeyMiddleware struct {
	apiKeyService *APIKeyService
}

// NewAPIKeyMiddleware creates a new API key middleware
func NewAPIKeyMiddleware(apiKeyService *APIKeyService) *APIKeyMiddleware {
	return &APIKeyMiddleware{
		apiKeyService: apiKeyService,
	}
}

// ValidateAPIKey middleware validates API keys with usage tracking
func (m *APIKeyMiddleware) ValidateAPIKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "API key required",
				"code":  "MISSING_API_KEY",
			})
			c.Abort()
			return
		}

		keyData, err := m.apiKeyService.ValidateAPIKey(c.Request.Context(), apiKey)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "Invalid API key",
				"code":    "INVALID_API_KEY",
				"details": err.Error(),
			})
			c.Abort()
			return
		}

		// Add rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(keyData.RateLimit))

		// Store API key data in context
		c.Set("api_key", keyData)
		c.Set("user_id", keyData.UserID)
		c.Set("usage_tier", keyData.UsageTier)
		c.Set("rate_limit", keyData.RateLimit)
		c.Set("key_id", keyData.KeyID)
		c.Next()
	}
}

// RequireTier middleware checks if API key has required pricing tier
func (m *APIKeyMiddleware) RequireTier(requiredTier models.PricingTier) gin.HandlerFunc {
	return func(c *gin.Context) {
		usageTier, exists := c.Get("usage_tier")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Usage tier not found in context",
				"code":  "MISSING_USAGE_TIER",
			})
			c.Abort()
			return
		}

		tier, ok := usageTier.(models.PricingTier)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Invalid usage tier format",
				"code":  "INVALID_USAGE_TIER",
			})
			c.Abort()
			return
		}

		if !m.hasSufficientTier(tier, requiredTier) {
			c.JSON(http.StatusForbidden, gin.H{
				"error":         "Insufficient pricing tier",
				"code":          "INSUFFICIENT_TIER",
				"required_tier": requiredTier,
				"current_tier":  tier,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// TrackUsage middleware tracks API key usage and enforces limits
func (m *APIKeyMiddleware) TrackUsage() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Process request first
		c.Next()

		// Track usage after request completion
		apiKey, exists := c.Get("api_key")
		if !exists {
			return
		}

		keyData, ok := apiKey.(*models.APIKey)
		if !ok {
			return
		}

		// Track usage asynchronously to avoid blocking response
		go func() {
			// Update usage statistics
			m.apiKeyService.trackAPIKeyUsage(c.Request.Context(), keyData)
		}()
	}
}

// RateLimitByTier middleware applies tier-specific rate limiting
func (m *APIKeyMiddleware) RateLimitByTier() gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey, exists := c.Get("api_key")
		if !exists {
			c.Next()
			return
		}

		keyData, ok := apiKey.(*models.APIKey)
		if !ok {
			c.Next()
			return
		}

		// Check rate limit using the API key service
		if m.apiKeyService.rateLimitService != nil {
			rateLimitKey := "api_key:" + keyData.KeyID
			result, err := m.apiKeyService.rateLimitService.CheckRateLimit(
				c.Request.Context(),
				rateLimitKey,
				keyData.RateLimit,
				60, // 1 minute window
			)

			if err != nil {
				// Log error but don't block request
				c.Header("X-RateLimit-Error", "Failed to check rate limit")
				c.Next()
				return
			}

			// Set rate limit headers
			c.Header("X-RateLimit-Limit", strconv.Itoa(keyData.RateLimit))
			c.Header("X-RateLimit-Remaining", strconv.Itoa(result.Remaining))
			c.Header("X-RateLimit-Reset", strconv.FormatInt(result.ResetTime, 10))

			if !result.Allowed {
				c.JSON(http.StatusTooManyRequests, gin.H{
					"error":       "Rate limit exceeded",
					"code":        "RATE_LIMIT_EXCEEDED",
					"limit":       keyData.RateLimit,
					"remaining":   result.Remaining,
					"reset_time":  result.ResetTime,
					"retry_after": result.RetryAfter,
				})
				c.Abort()
				return
			}

			// Increment counter for successful requests
			go m.apiKeyService.rateLimitService.IncrementCounter(
				c.Request.Context(),
				rateLimitKey,
				60,
			)
		}

		c.Next()
	}
}

// LogAPIKeyUsage middleware logs API key usage for analytics
func (m *APIKeyMiddleware) LogAPIKeyUsage() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		// Process request
		c.Next()

		// Log usage after request completion
		duration := time.Since(startTime)

		apiKey, exists := c.Get("api_key")
		if !exists {
			return
		}

		keyData, ok := apiKey.(*models.APIKey)
		if !ok {
			return
		}

		// Log usage data (in production, you'd send this to a logging service)
		logData := map[string]interface{}{
			"key_id":      keyData.KeyID,
			"user_id":     keyData.UserID,
			"usage_tier":  keyData.UsageTier,
			"method":      c.Request.Method,
			"path":        c.Request.URL.Path,
			"status_code": c.Writer.Status(),
			"duration_ms": duration.Milliseconds(),
			"timestamp":   time.Now().Unix(),
			"ip_address":  c.ClientIP(),
			"user_agent":  c.Request.UserAgent(),
		}

		// In production, send to analytics service
		_ = logData // Placeholder to avoid unused variable error
	}
}

// hasSufficientTier checks if current tier meets the requirement
func (m *APIKeyMiddleware) hasSufficientTier(currentTier, requiredTier models.PricingTier) bool {
	tierLevels := map[models.PricingTier]int{
		models.PricingTierDeveloper:  1,
		models.PricingTierGrowth:     2,
		models.PricingTierScale:      3,
		models.PricingTierEnterprise: 4,
	}

	currentLevel, exists := tierLevels[currentTier]
	if !exists {
		return false
	}

	requiredLevel, exists := tierLevels[requiredTier]
	if !exists {
		return false
	}

	return currentLevel >= requiredLevel
}
