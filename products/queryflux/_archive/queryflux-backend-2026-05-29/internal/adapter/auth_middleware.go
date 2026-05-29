package adapter

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/service"
)

const (
	AuthorizationHeader = "Authorization"
	BearerPrefix        = "Bearer "
	UserIDKey           = "user_id"
	UserEmailKey        = "user_email"
)

type AuthMiddleware struct {
	jwtService *service.JWTService
}

func NewAuthMiddleware(jwtService *service.JWTService) *AuthMiddleware {
	return &AuthMiddleware{
		jwtService: jwtService,
	}
}

func (m *AuthMiddleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader(AuthorizationHeader)
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "missing authorization header",
			})
			c.Abort()
			return
		}

		if !strings.HasPrefix(authHeader, BearerPrefix) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid authorization header format",
			})
			c.Abort()
			return
		}

		token := strings.TrimPrefix(authHeader, BearerPrefix)
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "missing token",
			})
			c.Abort()
			return
		}

		claims, err := m.jwtService.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": err.Error(),
			})
			c.Abort()
			return
		}

		c.Set(UserIDKey, claims.UserID)
		c.Set(UserEmailKey, claims.Email)
		c.Next()
	}
}

func GetUserID(c *gin.Context) (string, bool) {
	userID, exists := c.Get(UserIDKey)
	if !exists {
		return "", false
	}

	id, ok := userID.(string)
	return id, ok
}

func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get(UserEmailKey)
	if !exists {
		return "", false
	}

	userEmail, ok := email.(string)
	return userEmail, ok
}
