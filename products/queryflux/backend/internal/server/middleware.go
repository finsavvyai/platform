package server

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/sirupsen/logrus"
)

// JWTClaims represents the JWT claims
type JWTClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Plan   string `json:"plan"`
	jwt.RegisteredClaims
}

// AuthMiddleware provides JWT authentication middleware
func (s *Server) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			s.respondWithError(c, http.StatusUnauthorized, "MISSING_TOKEN", "Authorization header is required", nil)
			c.Abort()
			return
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			s.respondWithError(c, http.StatusUnauthorized, "INVALID_TOKEN_FORMAT", "Authorization header must start with 'Bearer '", nil)
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == "" {
			s.respondWithError(c, http.StatusUnauthorized, "EMPTY_TOKEN", "Token cannot be empty", nil)
			c.Abort()
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(s.config.JWTSecret), nil
		})

		if err != nil {
			logrus.WithError(err).Error("Failed to parse JWT token")
			s.respondWithError(c, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid or expired token", nil)
			c.Abort()
			return
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok || !token.Valid {
			s.respondWithError(c, http.StatusUnauthorized, "INVALID_CLAIMS", "Invalid token claims", nil)
			c.Abort()
			return
		}

		if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
			s.respondWithError(c, http.StatusUnauthorized, "TOKEN_EXPIRED", "Token has expired", nil)
			c.Abort()
			return
		}

		user := &entities.User{
			ID: claims.UserID, Email: claims.Email,
			Role: claims.Role, Plan: claims.Plan,
		}
		c.Set("user", user)
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		c.Set("user_plan", claims.Plan)

		c.Next()
	}
}

// CORSMiddleware provides CORS support
func (s *Server) CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if s.config.Environment == "development" || s.isAllowedOrigin(origin) {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Request-ID")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// RequestIDMiddleware adds a unique request ID to each request
func (s *Server) RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		c.Header("X-Request-ID", requestID)
		c.Set("request_id", requestID)
		ctx := context.WithValue(c.Request.Context(), "request_id", requestID)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func (s *Server) isAllowedOrigin(origin string) bool {
	allowedOrigins := []string{
		"http://localhost:3000", "http://localhost:5173",
		"https://queryflux.com", "https://www.queryflux.com",
	}
	for _, allowed := range allowedOrigins {
		if origin == allowed {
			return true
		}
	}
	return false
}

func generateRequestID() string {
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}
