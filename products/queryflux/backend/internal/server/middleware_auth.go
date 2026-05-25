package server

import (
	"net/http"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware creates authentication middleware
func AuthMiddleware(authService services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractTokenFromHeader(c)
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "MISSING_TOKEN",
				"message": "Authorization token is required",
			})
			c.Abort()
			return
		}

		user, err := authService.ValidateToken(c.Request.Context(), token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "INVALID_TOKEN",
				"message": "Invalid or expired token",
				"details": err.Error(),
			})
			c.Abort()
			return
		}

		// Set user information in context for use by handlers
		c.Set("user", user)
		c.Set("user_id", user.ID)
		c.Set("user_email", user.Email)
		c.Set("user_role", user.Role)
		c.Set("user_plan", user.Plan)

		c.Next()
	}
}

// OptionalAuthMiddleware creates optional authentication middleware
// This middleware will set user context if a valid token is provided, but won't fail if no token is provided
func OptionalAuthMiddleware(authService services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractTokenFromHeader(c)
		if token == "" {
			c.Next()
			return
		}

		user, err := authService.ValidateToken(c.Request.Context(), token)
		if err != nil {
			// Don't abort, just continue without user context
			c.Next()
			return
		}

		// Set user information in context for use by handlers
		c.Set("user", user)
		c.Set("user_id", user.ID)
		c.Set("user_email", user.Email)
		c.Set("user_role", user.Role)
		c.Set("user_plan", user.Plan)

		c.Next()
	}
}

// AdminMiddleware creates admin-only middleware
// This middleware requires authentication and admin role
func AdminMiddleware(authService services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// First run auth middleware
		AuthMiddleware(authService)(c)
		if c.IsAborted() {
			return
		}

		// Check if user has admin role
		userRole, exists := c.Get("user_role")
		if !exists || userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "INSUFFICIENT_PERMISSIONS",
				"message": "Admin access required",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// PlanMiddleware creates plan-based access middleware
func PlanMiddleware(requiredPlan string, authService services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// First run auth middleware
		AuthMiddleware(authService)(c)
		if c.IsAborted() {
			return
		}

		// Get user from context
		user, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "User not authenticated",
			})
			c.Abort()
			return
		}

		// Check if user has required plan
		userEntity := user.(*entities.User)
		if !userEntity.HasPlan(requiredPlan) {
			c.JSON(http.StatusForbidden, gin.H{
				"error":         "INSUFFICIENT_PLAN",
				"message":       "Upgrade your plan to access this feature",
				"required_plan": requiredPlan,
				"current_plan":  userEntity.Plan,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
