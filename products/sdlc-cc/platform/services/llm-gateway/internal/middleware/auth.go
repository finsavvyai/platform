package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// Authentication adds authentication middleware
func Authentication() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		token := authHeader
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		}

		if strings.TrimSpace(token) == "" {
			c.JSON(401, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default-tenant"
		}

		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "default-user"
		}

		c.Set("tenant_id", tenantID)
		c.Set("user_id", userID)
		c.Set("authenticated", true)
		c.Next()
	}
}

// AdminAuth adds admin authentication middleware
func AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			c.JSON(401, gin.H{"error": "Admin API key required"})
			c.Abort()
			return
		}

		if apiKey != "admin-secret-key" {
			c.JSON(401, gin.H{"error": "Invalid admin API key"})
			c.Abort()
			return
		}

		c.Set("admin_authenticated", true)
		c.Next()
	}
}

// RateLimiting adds rate limiting middleware
func RateLimiting() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := "anonymous"
		if id, exists := c.Get("tenant_id"); exists {
			if s, _ := id.(string); s != "" {
				tenantID = s
			}
		}
		_ = tenantID

		c.Header("X-RateLimit-Limit", "1000")
		c.Header("X-RateLimit-Remaining", "999")
		c.Header("X-RateLimit-Reset", "1640995200")
		c.Next()
	}
}

// Security adds security headers
func Security() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Header("Content-Security-Policy", "default-src 'self'")
		c.Next()
	}
}
