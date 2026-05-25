package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/services"
	"go.uber.org/zap"
)

// SubscriptionMiddleware provides middleware for subscription-based access control
type SubscriptionMiddleware struct {
	subscriptionService services.SubscriptionService
	logger              *zap.Logger
}

// NewSubscriptionMiddleware creates a new subscription middleware
func NewSubscriptionMiddleware(subscriptionService services.SubscriptionService, logger *zap.Logger) *SubscriptionMiddleware {
	return &SubscriptionMiddleware{
		subscriptionService: subscriptionService,
		logger:              logger,
	}
}

// RequireFeature checks if user has access to a specific feature
func (m *SubscriptionMiddleware) RequireFeature(feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: APIError{
					Code:    "unauthorized",
					Message: "Authentication required",
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		hasAccess, err := m.subscriptionService.CheckFeatureAccess(c.Request.Context(), userID.(string), feature)
		if err != nil {
			m.logger.Error("Failed to check feature access",
				zap.String("user_id", userID.(string)),
				zap.String("feature", feature),
				zap.Error(err),
			)
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error: APIError{
					Code:    "internal_error",
					Message: "Failed to verify access",
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		if !hasAccess {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Error: APIError{
					Code:    "feature_not_available",
					Message: "This feature is not available on your current plan",
					Details: map[string]interface{}{
						"feature":     feature,
						"upgrade_url": "/api/v1/subscriptions/plans",
					},
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireActiveSubscription checks if user has an active subscription
func (m *SubscriptionMiddleware) RequireActiveSubscription() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: APIError{
					Code:    "unauthorized",
					Message: "Authentication required",
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		subscription, err := m.subscriptionService.GetUserSubscription(c.Request.Context(), userID.(string))
		if err != nil {
			// No subscription found
			c.JSON(http.StatusForbidden, ErrorResponse{
				Error: APIError{
					Code:    "subscription_required",
					Message: "An active subscription is required to access this resource",
					Details: map[string]interface{}{
						"upgrade_url": "/api/v1/subscriptions/plans",
					},
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		if !subscription.IsActive() {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Error: APIError{
					Code:    "subscription_inactive",
					Message: "Your subscription is not active",
					Details: map[string]interface{}{
						"status":      subscription.Status,
						"ends_at":     subscription.EndsAt,
						"upgrade_url": "/api/v1/subscriptions/plans",
					},
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		// Add subscription to context for use in handlers
		c.Set("subscription", subscription)
		c.Next()
	}
}

// RequirePlan checks if user has a specific plan or higher
func (m *SubscriptionMiddleware) RequirePlan(minPlan string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: APIError{
					Code:    "unauthorized",
					Message: "Authentication required",
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		subscription, err := m.subscriptionService.GetUserSubscription(c.Request.Context(), userID.(string))
		if err != nil {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Error: APIError{
					Code:    "subscription_required",
					Message: "This feature requires a paid subscription",
					Details: map[string]interface{}{
						"required_plan": minPlan,
						"upgrade_url":   "/api/v1/subscriptions/plans",
					},
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		// Check plan level
		if !m.hasRequiredPlan(subscription.PlanType, minPlan) {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Error: APIError{
					Code:    "insufficient_plan",
					Message: "This feature requires a higher plan",
					Details: map[string]interface{}{
						"current_plan":  subscription.PlanType,
						"required_plan": minPlan,
						"upgrade_url":   "/api/v1/subscriptions/plans",
					},
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// CheckUsageLimit checks if user has exceeded their usage limits
func (m *SubscriptionMiddleware) CheckUsageLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: APIError{
					Code:    "unauthorized",
					Message: "Authentication required",
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		stats, err := m.subscriptionService.GetUserUsageStats(c.Request.Context(), userID.(string))
		if err != nil {
			// If we can't get stats, allow the request but log the error
			m.logger.Error("Failed to get usage stats",
				zap.String("user_id", userID.(string)),
				zap.Error(err),
			)
			c.Next()
			return
		}

		if stats.IsOverLimit {
			c.JSON(http.StatusTooManyRequests, ErrorResponse{
				Error: APIError{
					Code:    "usage_limit_exceeded",
					Message: "You have exceeded your usage limit for this billing period",
					Details: map[string]interface{}{
						"current_usage": stats.CurrentUsage,
						"usage_limit":   stats.UsageLimit,
						"renews_in":     stats.DaysUntilRenewal,
						"upgrade_url":   "/api/v1/subscriptions/plans",
					},
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		// Add usage stats to context
		c.Set("usage_stats", stats)
		c.Next()
	}
}

// APIKeyMiddleware checks API key and applies subscription limits
func (m *SubscriptionMiddleware) APIKeyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			// Try to get from query parameter
			apiKey = c.Query("api_key")
		}

		if apiKey == "" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: APIError{
					Code:    "api_key_required",
					Message: "API key is required",
				},
				Timestamp: getCurrentTimestamp(),
			})
			c.Abort()
			return
		}

		// TODO: Validate API key and get associated user
		// For now, we'll skip API key validation
		// In a real implementation, you would:
		// 1. Validate the API key
		// 2. Get the associated user ID
		// 3. Set user_id in context
		// 4. Apply rate limiting based on subscription

		c.Next()
	}
}

// FeatureListMiddleware returns available features based on subscription
func (m *SubscriptionMiddleware) FeatureListMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.Next()
			return
		}

		features := m.getAvailableFeatures(c.Request.Context(), userID.(string))
		c.Set("available_features", features)
		c.Next()
	}
}

// Helper methods

func (m *SubscriptionMiddleware) hasRequiredPlan(currentPlan, requiredPlan string) bool {
	planHierarchy := map[string]int{
		"free":       0,
		"monthly":    1,
		"yearly":     1,
		"lifetime":   2,
		"enterprise": 3,
	}

	currentLevel, exists := planHierarchy[currentPlan]
	if !exists {
		return false
	}

	requiredLevel, exists := planHierarchy[requiredPlan]
	if !exists {
		return false
	}

	return currentLevel >= requiredLevel
}

func (m *SubscriptionMiddleware) getAvailableFeatures(ctx interface{}, userID string) []string {
	// This would typically check the user's subscription and return available features
	// For now, return basic features
	return []string{
		"basic_query_execution",
		"connection_management",
		"export_results",
	}
}

// CORS middleware for Lemon Squeezy webhooks
func (m *SubscriptionMiddleware) WebhookCORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		// Allow Lemon Squeezy origin
		if strings.Contains(origin, "lemonsqueezy.com") {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, X-Signature")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}

		c.Next()
	}
}
