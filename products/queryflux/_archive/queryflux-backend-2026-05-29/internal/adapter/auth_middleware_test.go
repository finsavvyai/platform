package adapter

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func TestNewAuthMiddleware(t *testing.T) {
	jwtService := service.NewJWTService("test-secret")
	middleware := NewAuthMiddleware(jwtService)

	assert.NotNil(t, middleware)
	assert.NotNil(t, middleware.jwtService)
}

func TestAuthMiddleware_Authenticate_Success(t *testing.T) {
	jwtService := service.NewJWTService("test-secret")
	middleware := NewAuthMiddleware(jwtService)

	router := setupTestRouter()
	router.GET("/protected", middleware.Authenticate(), func(c *gin.Context) {
		userID, exists := GetUserID(c)
		require.True(t, exists)
		email, exists := GetUserEmail(c)
		require.True(t, exists)
		c.JSON(http.StatusOK, gin.H{"user_id": userID, "email": email})
	})

	token, err := jwtService.GenerateAccessToken("user-123", "test@example.com")
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set(AuthorizationHeader, BearerPrefix+token)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAuthMiddleware_Authenticate_MissingHeader(t *testing.T) {
	jwtService := service.NewJWTService("test-secret")
	middleware := NewAuthMiddleware(jwtService)

	router := setupTestRouter()
	router.GET("/protected", middleware.Authenticate(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "missing authorization header")
}

func TestAuthMiddleware_Authenticate_InvalidHeaderFormat(t *testing.T) {
	jwtService := service.NewJWTService("test-secret")
	middleware := NewAuthMiddleware(jwtService)

	router := setupTestRouter()
	router.GET("/protected", middleware.Authenticate(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set(AuthorizationHeader, "InvalidFormat token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "invalid authorization header format")
}

func TestAuthMiddleware_Authenticate_MissingToken(t *testing.T) {
	jwtService := service.NewJWTService("test-secret")
	middleware := NewAuthMiddleware(jwtService)

	router := setupTestRouter()
	router.GET("/protected", middleware.Authenticate(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set(AuthorizationHeader, BearerPrefix)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "missing token")
}

func TestAuthMiddleware_Authenticate_InvalidToken(t *testing.T) {
	jwtService := service.NewJWTService("test-secret")
	middleware := NewAuthMiddleware(jwtService)

	router := setupTestRouter()
	router.GET("/protected", middleware.Authenticate(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set(AuthorizationHeader, BearerPrefix+"invalid.token.here")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_Authenticate_ExpiredToken(t *testing.T) {
	jwtService := service.NewJWTService("test-secret")
	middleware := NewAuthMiddleware(jwtService)

	router := setupTestRouter()
	router.GET("/protected", middleware.Authenticate(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	expiredToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlci0xMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJleHAiOjE2MDAwMDAwMDAsImlhdCI6MTYwMDAwMDAwMCwibmJmIjoxNjAwMDAwMDAwfQ.X"

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set(AuthorizationHeader, BearerPrefix+expiredToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_Authenticate_WithWrongSecret(t *testing.T) {
	jwtService := service.NewJWTService("test-secret")
	wrongJWTService := service.NewJWTService("wrong-secret")
	middleware := NewAuthMiddleware(jwtService)

	router := setupTestRouter()
	router.GET("/protected", middleware.Authenticate(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	token, err := wrongJWTService.GenerateAccessToken("user-123", "test@example.com")
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set(AuthorizationHeader, BearerPrefix+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
