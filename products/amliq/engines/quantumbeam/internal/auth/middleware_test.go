package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// MockAuthService is a mock implementation of AuthService
type MockAuthService struct {
	mock.Mock
}

func (m *MockAuthService) AuthenticateJWT(ctx context.Context, token string) (*models.User, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockAuthService) GenerateJWT(ctx context.Context, user *models.User) (*interfaces.JWTTokens, error) {
	args := m.Called(ctx, user)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.JWTTokens), args.Error(1)
}

func (m *MockAuthService) RefreshJWT(ctx context.Context, refreshToken string) (*interfaces.JWTTokens, error) {
	args := m.Called(ctx, refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.JWTTokens), args.Error(1)
}

func (m *MockAuthService) ValidateJWT(ctx context.Context, token string) (*interfaces.JWTClaims, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.JWTClaims), args.Error(1)
}

func (m *MockAuthService) RevokeJWT(ctx context.Context, token string) error {
	args := m.Called(ctx, token)
	return args.Error(0)
}

func (m *MockAuthService) ValidateAPIKey(ctx context.Context, apiKey string) (*models.APIKey, error) {
	args := m.Called(ctx, apiKey)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.APIKey), args.Error(1)
}

func (m *MockAuthService) GenerateAPIKey(ctx context.Context, userID string, tier models.PricingTier, name string) (*interfaces.APIKeyResponse, error) {
	args := m.Called(ctx, userID, tier, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.APIKeyResponse), args.Error(1)
}

func (m *MockAuthService) RevokeAPIKey(ctx context.Context, keyID string) error {
	args := m.Called(ctx, keyID)
	return args.Error(0)
}

func (m *MockAuthService) RotateAPIKey(ctx context.Context, keyID string) (*interfaces.APIKeyResponse, error) {
	args := m.Called(ctx, keyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.APIKeyResponse), args.Error(1)
}

func (m *MockAuthService) ListAPIKeys(ctx context.Context, userID string) ([]*models.APIKey, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.APIKey), args.Error(1)
}

func (m *MockAuthService) ProcessSSOLogin(ctx context.Context, provider string, assertion string) (*interfaces.SSOResult, error) {
	args := m.Called(ctx, provider, assertion)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.SSOResult), args.Error(1)
}

func (m *MockAuthService) ConfigureSSO(ctx context.Context, config *interfaces.SSOConfig) error {
	args := m.Called(ctx, config)
	return args.Error(0)
}

func (m *MockAuthService) ValidateSSOAssertion(ctx context.Context, provider string, assertion string) (*interfaces.SSOUserInfo, error) {
	args := m.Called(ctx, provider, assertion)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.SSOUserInfo), args.Error(1)
}

func (m *MockAuthService) GetSSOProviders(ctx context.Context) ([]interfaces.SSOProvider, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]interfaces.SSOProvider), args.Error(1)
}

func setupTestMiddleware() (*AuthMiddleware, *JWTService, *MockAuthService) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1,
	})

	config := &JWTConfig{
		SecretKey:       "test-secret-key-32-characters-long",
		RefreshKey:      "test-refresh-key-32-characters-long",
		Issuer:          "quantumbeam-test",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		RedisClient:     redisClient,
	}

	jwtService := NewJWTService(config)
	mockAuthService := &MockAuthService{}
	rateLimitService := NewRateLimitService(redisClient)

	middleware := NewAuthMiddleware(jwtService, mockAuthService, rateLimitService)

	return middleware, jwtService, mockAuthService
}

func TestAuthMiddleware_JWTAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	middleware, jwtService, _ := setupTestMiddleware()

	// Skip test if Redis is not available
	ctx := context.Background()
	if err := jwtService.redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available for testing")
	}

	defer jwtService.redisClient.FlushDB(ctx)

	user := &models.User{
		UserID: "test-user-123",
		Email:  "test@example.com",
		Role:   models.UserRoleDeveloper,
	}

	t.Run("successful JWT authentication", func(t *testing.T) {
		// Generate valid token
		tokens, err := jwtService.GenerateJWT(ctx, user)
		require.NoError(t, err)

		// Setup Gin router
		router := gin.New()
		router.Use(middleware.JWTAuth())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		// Create request with valid token
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokens.AccessToken)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("missing authorization header", func(t *testing.T) {
		router := gin.New()
		router.Use(middleware.JWTAuth())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "Authorization header required")
	})

	t.Run("invalid authorization header format", func(t *testing.T) {
		router := gin.New()
		router.Use(middleware.JWTAuth())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "InvalidFormat token")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "Invalid authorization header format")
	})

	t.Run("invalid token", func(t *testing.T) {
		router := gin.New()
		router.Use(middleware.JWTAuth())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer invalid-token")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "Invalid or expired token")
	})
}

func TestAuthMiddleware_APIKeyAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	middleware, _, mockAuthService := setupTestMiddleware()

	apiKey := &models.APIKey{
		KeyID:     "test-key-123",
		UserID:    "test-user-123",
		UsageTier: models.PricingTierDeveloper,
		RateLimit: 100,
	}

	t.Run("successful API key authentication", func(t *testing.T) {
		mockAuthService.On("ValidateAPIKey", mock.Anything, "valid-api-key").Return(apiKey, nil)

		router := gin.New()
		router.Use(middleware.APIKeyAuth())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-API-Key", "valid-api-key")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		mockAuthService.AssertExpectations(t)
	})

	t.Run("missing API key", func(t *testing.T) {
		router := gin.New()
		router.Use(middleware.APIKeyAuth())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "API key required")
	})

	t.Run("invalid API key", func(t *testing.T) {
		mockAuthService.On("ValidateAPIKey", mock.Anything, "invalid-api-key").Return(nil, assert.AnError)

		router := gin.New()
		router.Use(middleware.APIKeyAuth())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-API-Key", "invalid-api-key")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "Invalid API key")
		mockAuthService.AssertExpectations(t)
	})
}

func TestAuthMiddleware_RequireRole(t *testing.T) {
	gin.SetMode(gin.TestMode)

	middleware, _, _ := setupTestMiddleware()

	t.Run("admin can access admin endpoint", func(t *testing.T) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("user_role", models.UserRoleAdmin)
			c.Next()
		})
		router.Use(middleware.RequireRole(models.UserRoleAdmin))
		router.GET("/admin", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "admin access"})
		})

		req := httptest.NewRequest("GET", "/admin", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("developer cannot access admin endpoint", func(t *testing.T) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("user_role", models.UserRoleDeveloper)
			c.Next()
		})
		router.Use(middleware.RequireRole(models.UserRoleAdmin))
		router.GET("/admin", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "admin access"})
		})

		req := httptest.NewRequest("GET", "/admin", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Contains(t, w.Body.String(), "Insufficient permissions")
	})

	t.Run("enterprise can access developer endpoint", func(t *testing.T) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("user_role", models.UserRoleEnterprise)
			c.Next()
		})
		router.Use(middleware.RequireRole(models.UserRoleDeveloper))
		router.GET("/dev", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "developer access"})
		})

		req := httptest.NewRequest("GET", "/dev", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("missing user role", func(t *testing.T) {
		router := gin.New()
		router.Use(middleware.RequireRole(models.UserRoleDeveloper))
		router.GET("/dev", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "developer access"})
		})

		req := httptest.NewRequest("GET", "/dev", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Contains(t, w.Body.String(), "User role not found in context")
	})
}

func TestGetUserFromContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	user := &models.User{
		UserID: "test-user-123",
		Email:  "test@example.com",
		Role:   models.UserRoleDeveloper,
	}

	t.Run("user exists in context", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("user", user)

		retrievedUser, exists := GetUserFromContext(c)

		assert.True(t, exists)
		assert.Equal(t, user, retrievedUser)
	})

	t.Run("user does not exist in context", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())

		retrievedUser, exists := GetUserFromContext(c)

		assert.False(t, exists)
		assert.Nil(t, retrievedUser)
	})
}

func TestGetAPIKeyFromContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	apiKey := &models.APIKey{
		KeyID:     "test-key-123",
		UserID:    "test-user-123",
		UsageTier: models.PricingTierDeveloper,
	}

	t.Run("API key exists in context", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("api_key", apiKey)

		retrievedKey, exists := GetAPIKeyFromContext(c)

		assert.True(t, exists)
		assert.Equal(t, apiKey, retrievedKey)
	})

	t.Run("API key does not exist in context", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())

		retrievedKey, exists := GetAPIKeyFromContext(c)

		assert.False(t, exists)
		assert.Nil(t, retrievedKey)
	})
}

func TestGetUserIDFromContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("user ID exists in context", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("user_id", "test-user-123")

		userID, exists := GetUserIDFromContext(c)

		assert.True(t, exists)
		assert.Equal(t, "test-user-123", userID)
	})

	t.Run("user ID does not exist in context", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())

		userID, exists := GetUserIDFromContext(c)

		assert.False(t, exists)
		assert.Empty(t, userID)
	})
}
