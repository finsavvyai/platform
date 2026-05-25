package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/logger"
	"quantumbeam/internal/models"
)

// AuthMiddleware provides authentication middleware for Gin
type AuthMiddleware struct {
	jwtService       *JWTService
	apiKeyService    interfaces.AuthService
	rateLimitService interfaces.RateLimitService
}

// NewAuthMiddleware creates a new authentication middleware
func NewAuthMiddleware(jwtService *JWTService, apiKeyService interfaces.AuthService, rateLimitService interfaces.RateLimitService) *AuthMiddleware {
	return &AuthMiddleware{
		jwtService:       jwtService,
		apiKeyService:    apiKeyService,
		rateLimitService: rateLimitService,
	}
}

// JWTAuth middleware validates JWT tokens
func (m *AuthMiddleware) JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			logger.NewAuditLogger(nil, nil).LogAuthFailure(
				c.ClientIP(),
				c.FullPath(),
				c.GetHeader("X-Request-ID"),
				"missing_authorization_header",
			)
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header required",
				"code":  "MISSING_AUTH_HEADER",
			})
			c.Abort()
			return
		}

		// Extract Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			logger.NewAuditLogger(nil, nil).LogAuthFailure(
				c.ClientIP(),
				c.FullPath(),
				c.GetHeader("X-Request-ID"),
				"invalid_authorization_header_format",
			)
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization header format",
				"code":  "INVALID_AUTH_FORMAT",
			})
			c.Abort()
			return
		}

		token := parts[1]
		user, err := m.jwtService.AuthenticateJWT(c.Request.Context(), token)
		if err != nil {
			logger.NewAuditLogger(nil, nil).LogAuthFailure(
				c.ClientIP(),
				c.FullPath(),
				c.GetHeader("X-Request-ID"),
				sanitizeAuditDetail("jwt_auth_failed:"+err.Error()),
			)
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "Invalid or expired token",
				"code":    "INVALID_TOKEN",
				"details": err.Error(),
			})
			c.Abort()
			return
		}

		// Store user in context
		c.Set("user", user)
		c.Set("user_id", user.UserID)
		c.Set("user_role", user.Role)
		logger.NewAuditLogger(nil, nil).LogAuthSuccess(
			user.UserID,
			c.ClientIP(),
			c.FullPath(),
			c.GetHeader("X-Request-ID"),
		)
		c.Next()
	}
}

// APIKeyAuth middleware validates API keys
func (m *AuthMiddleware) APIKeyAuth() gin.HandlerFunc {
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

		// Store API key data in context
		c.Set("api_key", keyData)
		c.Set("user_id", keyData.UserID)
		c.Set("usage_tier", keyData.UsageTier)
		c.Set("rate_limit", keyData.RateLimit)
		c.Next()
	}
}

// OptionalAuth middleware allows both JWT and API key authentication
func (m *AuthMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Try JWT first
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				user, err := m.jwtService.AuthenticateJWT(c.Request.Context(), parts[1])
				if err == nil {
					c.Set("user", user)
					c.Set("user_id", user.UserID)
					c.Set("user_role", user.Role)
					c.Set("auth_method", "jwt")
					c.Next()
					return
				}
			}
		}

		// Try API key
		apiKey := c.GetHeader("X-API-Key")
		if apiKey != "" {
			keyData, err := m.apiKeyService.ValidateAPIKey(c.Request.Context(), apiKey)
			if err == nil {
				c.Set("api_key", keyData)
				c.Set("user_id", keyData.UserID)
				c.Set("usage_tier", keyData.UsageTier)
				c.Set("rate_limit", keyData.RateLimit)
				c.Set("auth_method", "api_key")
				c.Next()
				return
			}
		}

		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Valid authentication required",
			"code":  "AUTHENTICATION_REQUIRED",
		})
		c.Abort()
	}
}

// RequireRole middleware checks if user has required role
func (m *AuthMiddleware) RequireRole(requiredRole models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "User role not found in context",
				"code":  "MISSING_USER_ROLE",
			})
			c.Abort()
			return
		}

		role, ok := userRole.(models.UserRole)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Invalid user role format",
				"code":  "INVALID_USER_ROLE",
			})
			c.Abort()
			return
		}

		if !m.hasRequiredRole(role, requiredRole) {
			userID, _ := GetUserIDFromContext(c)
			logger.NewAuditLogger(nil, nil).LogRBACDenied(
				userID,
				c.ClientIP(),
				c.FullPath(),
				c.GetHeader("X-Request-ID"),
			)
			c.JSON(http.StatusForbidden, gin.H{
				"error":         "Insufficient permissions",
				"code":          "INSUFFICIENT_PERMISSIONS",
				"required_role": requiredRole,
				"user_role":     role,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimit middleware implements rate limiting
func (m *AuthMiddleware) RateLimit(defaultLimit int, window time.Duration) gin.HandlerFunc {
	// Create a map to store rate limiters for different keys
	limiters := make(map[string]*rate.Limiter)

	return func(c *gin.Context) {
		// Determine rate limit key and limit
		var key string
		var limit int

		// Check if API key is present and has custom rate limit
		if apiKey, exists := c.Get("api_key"); exists {
			if keyData, ok := apiKey.(*models.APIKey); ok {
				key = "api_key:" + keyData.KeyID
				limit = keyData.RateLimit
			}
		} else if userID, exists := c.Get("user_id"); exists {
			if uid, ok := userID.(string); ok {
				key = "user:" + uid
				limit = defaultLimit
			}
		} else {
			// Use IP address as fallback
			key = "ip:" + c.ClientIP()
			limit = defaultLimit / 10 // Lower limit for unauthenticated requests
		}

		// Get or create rate limiter for this key
		limiter, exists := limiters[key]
		if !exists {
			limiter = rate.NewLimiter(rate.Every(window/time.Duration(limit)), limit)
			limiters[key] = limiter
		}

		// Check rate limit
		if !limiter.Allow() {
			c.Header("X-RateLimit-Limit", string(rune(limit)))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", string(rune(time.Now().Add(window).Unix())))

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":  "Rate limit exceeded",
				"code":   "RATE_LIMIT_EXCEEDED",
				"limit":  limit,
				"window": window.String(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// BruteForceProtection middleware protects against brute force attacks
func (m *AuthMiddleware) BruteForceProtection() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		// Check if IP is temporarily blocked
		if m.rateLimitService != nil {
			result, err := m.rateLimitService.CheckRateLimit(
				c.Request.Context(),
				"brute_force:"+clientIP,
				5,   // 5 failed attempts
				300, // 5 minute window
			)

			if err == nil && !result.Allowed {
				c.JSON(http.StatusTooManyRequests, gin.H{
					"error":       "Too many failed authentication attempts",
					"code":        "BRUTE_FORCE_PROTECTION",
					"retry_after": result.RetryAfter,
				})
				c.Abort()
				return
			}
		}

		c.Next()

		// If authentication failed, increment counter
		if c.Writer.Status() == http.StatusUnauthorized && m.rateLimitService != nil {
			m.rateLimitService.IncrementCounter(
				context.Background(),
				"brute_force:"+clientIP,
				300, // 5 minute window
			)
		}
	}
}

// hasRequiredRole checks if user role meets the requirement
func (m *AuthMiddleware) hasRequiredRole(userRole, requiredRole models.UserRole) bool {
	// Admin can access everything
	if userRole == models.UserRoleAdmin {
		return true
	}

	// Exact role match
	if userRole == requiredRole {
		return true
	}

	// Enterprise users can access developer and viewer features
	if userRole == models.UserRoleEnterprise &&
		(requiredRole == models.UserRoleDeveloper || requiredRole == models.UserRoleViewer) {
		return true
	}

	// Developer users can access viewer features
	if userRole == models.UserRoleDeveloper && requiredRole == models.UserRoleViewer {
		return true
	}

	return false
}

// GetUserFromContext extracts user from Gin context
func GetUserFromContext(c *gin.Context) (*models.User, bool) {
	user, exists := c.Get("user")
	if !exists {
		return nil, false
	}

	u, ok := user.(*models.User)
	return u, ok
}

// GetAPIKeyFromContext extracts API key from Gin context
func GetAPIKeyFromContext(c *gin.Context) (*models.APIKey, bool) {
	apiKey, exists := c.Get("api_key")
	if !exists {
		return nil, false
	}

	key, ok := apiKey.(*models.APIKey)
	return key, ok
}

// GetUserIDFromContext extracts user ID from Gin context
func GetUserIDFromContext(c *gin.Context) (string, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return "", false
	}

	uid, ok := userID.(string)
	return uid, ok
}
