package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/models"
)

// RequireAuthOrAPIKey accepts either JWT token or API key for authentication
func RequireAuthOrAPIKey(scopes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// First try JWT authentication
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			// Try JWT auth
			jwtHandler := RequireAuth()
			jwtHandler(c)
			if !c.IsAborted() {
				// JWT auth succeeded
				c.Next()
				return
			}
		}

		// If JWT failed, try API key authentication
		apiKey := c.GetHeader("X-API-Key")
		if apiKey != "" {
			apiKeyHandler := RequireAPIKey(scopes)
			apiKeyHandler(c)
			if !c.IsAborted() {
				// API key auth succeeded
				c.Next()
				return
			}
		}

		// Both authentication methods failed
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authentication required. Please provide either a Bearer token or X-API-Key header.",
			"code":  "AUTHENTICATION_REQUIRED",
		})
		c.Abort()
	}
}

// RequireAdmin requires admin role
func RequireAdmin() gin.HandlerFunc {
	return RequireRole(models.RoleAdmin)
}
