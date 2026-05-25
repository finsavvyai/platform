package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/models"
	"gorm.io/gorm"
)

type Claims struct {
	UserID string          `json:"user_id"`
	Email  string          `json:"email"`
	Role   models.UserRole `json:"role"`
	jwt.RegisteredClaims
}

func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header required",
				"code":  "AUTH_REQUIRED",
			})
			c.Abort()
			return
		}

		// Extract Bearer token
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Bearer token required",
				"code":  "BEARER_TOKEN_REQUIRED",
			})
			c.Abort()
			return
		}

		// Get JWT secret from config
		cfg, exists := c.MustGet("config").(*config.Config)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Configuration not found",
				"code":  "CONFIG_ERROR",
			})
			c.Abort()
			return
		}

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(cfg.JWT.Secret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token",
				"code":  "INVALID_TOKEN",
			})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(*Claims); ok && token.Valid {
			// Check if token is expired
			if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error": "Token expired",
					"code":  "TOKEN_EXPIRED",
				})
				c.Abort()
				return
			}

			c.Set("user_id", claims.UserID)
			c.Set("email", claims.Email)
			c.Set("role", claims.Role)
			c.Next()
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token claims",
				"code":  "INVALID_CLAIMS",
			})
			c.Abort()
			return
		}
	}
}

func RequireRole(role models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User role not found",
				"code":  "ROLE_NOT_FOUND",
			})
			c.Abort()
			return
		}

		userRoleStr, ok := userRole.(models.UserRole)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid role format",
				"code":  "INVALID_ROLE_FORMAT",
			})
			c.Abort()
			return
		}

		// Admin can access everything
		if userRoleStr == models.RoleAdmin {
			c.Next()
			return
		}

		if userRoleStr != role {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Insufficient permissions",
				"code":  "INSUFFICIENT_PERMISSIONS",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func RequireAPIKey(scopes []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "API key required",
				"code":  "API_KEY_REQUIRED",
			})
			c.Abort()
			return
		}

		// Get database from context
		db, exists := c.MustGet("db").(*gorm.DB)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Database connection not found",
				"code":  "DB_ERROR",
			})
			c.Abort()
			return
		}

		// Find API key in database
		var apiKeyModel models.APIKey
		if err := db.Where("key_hash = ? AND is_active = ?", hashAPIKey(apiKey), true).First(&apiKeyModel).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid API key",
				"code":  "INVALID_API_KEY",
			})
			c.Abort()
			return
		}

		// Check if API key is expired
		if apiKeyModel.ExpiresAt != nil && apiKeyModel.ExpiresAt.Before(time.Now()) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "API key expired",
				"code":  "API_KEY_EXPIRED",
			})
			c.Abort()
			return
		}

		// Check scopes
		if len(scopes) > 0 {
			hasRequiredScope := false
			for _, requiredScope := range scopes {
				for _, keyScope := range apiKeyModel.Scopes {
					if keyScope == requiredScope {
						hasRequiredScope = true
						break
					}
				}
				if hasRequiredScope {
					break
				}
			}

			if !hasRequiredScope {
				c.JSON(http.StatusForbidden, gin.H{
					"error": "Insufficient API key scopes",
					"code":  "INSUFFICIENT_SCOPES",
				})
				c.Abort()
				return
			}
		}

		// Update last used timestamp
		now := time.Now()
		db.Model(&apiKeyModel).Update("last_used", now)

		c.Set("api_key_id", apiKeyModel.ID)
		c.Set("user_id", apiKeyModel.UserID)
		c.Next()
	}
}

func hashAPIKey(apiKey string) string {
	h := hmac.New(sha256.New, []byte("mcpoverflow-api-key-salt"))
	h.Write([]byte(apiKey))
	return hex.EncodeToString(h.Sum(nil))
}

// HashAPIKey exported function for use in handlers
func HashAPIKey(apiKey string) string {
	return hashAPIKey(apiKey)
}
