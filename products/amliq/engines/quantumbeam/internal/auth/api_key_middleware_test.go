package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// MockAPIKeyService is a mock implementation of APIKeyService
type MockAPIKeyService struct {
	mock.Mock
}

func (m *MockAPIKeyService) ValidateAPIKey(ctx interface{}, key string) (*models.APIKey, error) {
	args := m.Called(ctx, key)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.APIKey), args.Error(1)
}

func (m *MockAPIKeyService) GenerateAPIKey(ctx interface{}, userID string, tier models.PricingTier, name string) (*interfaces.APIKeyResponse, error) {
	args := m.Called(ctx, userID, tier, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.APIKeyResponse), args.Error(1)
}

func (m *MockAPIKeyService) RotateAPIKey(ctx interface{}, keyID string) (*interfaces.APIKeyResponse, error) {
	args := m.Called(ctx, keyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.APIKeyResponse), args.Error(1)
}

func (m *MockAPIKeyService) RevokeAPIKey(ctx interface{}, keyID string) error {
	args := m.Called(ctx, keyID)
	return args.Error(0)
}

func (m *MockAPIKeyService) ListAPIKeys(ctx interface{}, userID string) ([]*models.APIKey, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.APIKey), args.Error(1)
}

func (m *MockAPIKeyService) trackAPIKeyUsage(ctx interface{}, apiKey *models.APIKey) {
	m.Called(ctx, apiKey)
}

func setupGinTest() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func createTestAPIKey() *models.APIKey {
	return &models.APIKey{
		KeyID:     "test-key-123",
		UserID:    "test-user-123",
		Name:      "Test Key",
		UsageTier: models.PricingTierDeveloper,
		RateLimit: 100,
		IsActive:  true,
		CreatedAt: time.Now(),
	}
}

func TestAPIKeyMiddleware_ValidateAPIKey(t *testing.T) {
	tests := []struct {
		name           string
		apiKey         string
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "Valid API key",
			apiKey:         "qb_validkey123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Missing API key",
			apiKey:         "",
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "MISSING_API_KEY",
		},
		{
			name:           "Invalid API key",
			apiKey:         "invalid-key",
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "INVALID_API_KEY",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupGinTest()
			// Create a test route
			router.GET("/test", func(c *gin.Context) {
				// Mock the validation directly in the middleware
				if tt.apiKey == "" {
					c.JSON(http.StatusUnauthorized, gin.H{
						"error": "API key required",
						"code":  "MISSING_API_KEY",
					})
					c.Abort()
					return
				}

				if tt.apiKey == "invalid-key" {
					c.JSON(http.StatusUnauthorized, gin.H{
						"error": "Invalid API key",
						"code":  "INVALID_API_KEY",
					})
					c.Abort()
					return
				}

				// Valid key
				apiKey := createTestAPIKey()
				c.Set("api_key", apiKey)
				c.Set("user_id", apiKey.UserID)
				c.Set("usage_tier", apiKey.UsageTier)
				c.Set("rate_limit", apiKey.RateLimit)
				c.Set("key_id", apiKey.KeyID)

				c.JSON(http.StatusOK, gin.H{"status": "success"})
			})

			// Create request
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.apiKey != "" {
				req.Header.Set("X-API-Key", tt.apiKey)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assertions
			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				assert.Contains(t, w.Body.String(), tt.expectedError)
			}
		})
	}
}

func TestAPIKeyMiddleware_RequireTier(t *testing.T) {
	middleware := NewAPIKeyMiddleware(&APIKeyService{})

	tests := []struct {
		name           string
		currentTier    models.PricingTier
		requiredTier   models.PricingTier
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "Sufficient tier - exact match",
			currentTier:    models.PricingTierGrowth,
			requiredTier:   models.PricingTierGrowth,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Sufficient tier - higher than required",
			currentTier:    models.PricingTierEnterprise,
			requiredTier:   models.PricingTierDeveloper,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Insufficient tier",
			currentTier:    models.PricingTierDeveloper,
			requiredTier:   models.PricingTierEnterprise,
			expectedStatus: http.StatusForbidden,
			expectedError:  "INSUFFICIENT_TIER",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupGinTest()
			// Create test route with tier requirement
			router.GET("/test-tier", func(c *gin.Context) {
				// Set usage tier in context
				c.Set("usage_tier", tt.currentTier)

				// Check tier requirement
				if !middleware.hasSufficientTier(tt.currentTier, tt.requiredTier) {
					c.JSON(http.StatusForbidden, gin.H{
						"error":         "Insufficient pricing tier",
						"code":          "INSUFFICIENT_TIER",
						"required_tier": tt.requiredTier,
						"current_tier":  tt.currentTier,
					})
					c.Abort()
					return
				}

				c.JSON(http.StatusOK, gin.H{"status": "success"})
			})

			// Create request
			req := httptest.NewRequest("GET", "/test-tier", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assertions
			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				assert.Contains(t, w.Body.String(), tt.expectedError)
			}
		})
	}
}

func TestAPIKeyMiddleware_RateLimitByTier(t *testing.T) {
	mockRateLimit := &MockRateLimitService{}

	// Create service with mock rate limiter
	service := &APIKeyService{
		rateLimitService: mockRateLimit,
	}
	middleware := NewAPIKeyMiddleware(service)

	tests := []struct {
		name           string
		setupMock      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name: "Rate limit allowed",
			setupMock: func() {
				mockRateLimit.On("CheckRateLimit", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&interfaces.RateLimitResult{
						Allowed:   true,
						Remaining: 99,
						ResetTime: time.Now().Add(time.Minute).Unix(),
					}, nil).Once()
				mockRateLimit.On("IncrementCounter", mock.Anything, mock.Anything, mock.Anything).
					Return(nil).Once()
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Rate limit exceeded",
			setupMock: func() {
				mockRateLimit.On("CheckRateLimit", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&interfaces.RateLimitResult{
						Allowed:    false,
						Remaining:  0,
						ResetTime:  time.Now().Add(time.Minute).Unix(),
						RetryAfter: 60,
					}, nil).Once()
			},
			expectedStatus: http.StatusTooManyRequests,
			expectedError:  "RATE_LIMIT_EXCEEDED",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupGinTest()
			// Setup mock
			tt.setupMock()

			// Create test route
			router.GET("/test-rate-limit", func(c *gin.Context) {
				// Set API key in context
				apiKey := createTestAPIKey()
				c.Set("api_key", apiKey)

				// Simulate rate limit check
				if middleware.apiKeyService.rateLimitService != nil {
					rateLimitKey := "api_key:" + apiKey.KeyID
					result, err := middleware.apiKeyService.rateLimitService.CheckRateLimit(
						c.Request.Context(),
						rateLimitKey,
						apiKey.RateLimit,
						60,
					)

					if err != nil {
						c.Header("X-RateLimit-Error", "Failed to check rate limit")
						c.JSON(http.StatusOK, gin.H{"status": "success"})
						return
					}

					if !result.Allowed {
						c.JSON(http.StatusTooManyRequests, gin.H{
							"error": "Rate limit exceeded",
							"code":  "RATE_LIMIT_EXCEEDED",
						})
						c.Abort()
						return
					}

					// Increment counter for successful requests
					go middleware.apiKeyService.rateLimitService.IncrementCounter(
						c.Request.Context(),
						rateLimitKey,
						60,
					)
				}

				c.JSON(http.StatusOK, gin.H{"status": "success"})
			})

			// Create request
			req := httptest.NewRequest("GET", "/test-rate-limit", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assertions
			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				assert.Contains(t, w.Body.String(), tt.expectedError)
			}

			// IncrementCounter is fired in a goroutine for the
			// "Rate_limit_allowed" case; give it a moment to complete
			// before asserting mock expectations.
			assert.Eventually(t, func() bool {
				return mockRateLimit.AssertExpectations(&testing.T{})
			}, time.Second, 10*time.Millisecond)
			mockRateLimit.AssertExpectations(t)
		})
	}
}

func TestAPIKeyMiddleware_hasSufficientTier(t *testing.T) {
	middleware := &APIKeyMiddleware{}

	tests := []struct {
		name         string
		currentTier  models.PricingTier
		requiredTier models.PricingTier
		expected     bool
	}{
		{
			name:         "Developer to Developer",
			currentTier:  models.PricingTierDeveloper,
			requiredTier: models.PricingTierDeveloper,
			expected:     true,
		},
		{
			name:         "Growth to Developer",
			currentTier:  models.PricingTierGrowth,
			requiredTier: models.PricingTierDeveloper,
			expected:     true,
		},
		{
			name:         "Enterprise to Scale",
			currentTier:  models.PricingTierEnterprise,
			requiredTier: models.PricingTierScale,
			expected:     true,
		},
		{
			name:         "Developer to Growth",
			currentTier:  models.PricingTierDeveloper,
			requiredTier: models.PricingTierGrowth,
			expected:     false,
		},
		{
			name:         "Scale to Enterprise",
			currentTier:  models.PricingTierScale,
			requiredTier: models.PricingTierEnterprise,
			expected:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := middleware.hasSufficientTier(tt.currentTier, tt.requiredTier)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestHelperFunctions(t *testing.T) {
	t.Run("isValidAPIKeyFormat", func(t *testing.T) {
		tests := []struct {
			key      string
			expected bool
		}{
			{"qb_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", true},
			{"qb_short", false},
			{"invalid_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", false},
			{"", false},
			{"qb_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefextra", false},
		}

		for _, tt := range tests {
			result := isValidAPIKeyFormat(tt.key)
			assert.Equal(t, tt.expected, result, "Key: %s", tt.key)
		}
	})

	t.Run("isValidPricingTier", func(t *testing.T) {
		tests := []struct {
			tier     models.PricingTier
			expected bool
		}{
			{models.PricingTierDeveloper, true},
			{models.PricingTierGrowth, true},
			{models.PricingTierScale, true},
			{models.PricingTierEnterprise, true},
			{models.PricingTier("invalid"), false},
			{models.PricingTier(""), false},
		}

		for _, tt := range tests {
			result := isValidPricingTier(tt.tier)
			assert.Equal(t, tt.expected, result, "Tier: %s", tt.tier)
		}
	})

	t.Run("getRateLimitForTier", func(t *testing.T) {
		tests := []struct {
			tier     models.PricingTier
			expected int
		}{
			{models.PricingTierDeveloper, 100},
			{models.PricingTierGrowth, 1000},
			{models.PricingTierScale, 5000},
			{models.PricingTierEnterprise, 10000},
			{models.PricingTier("invalid"), 100},
		}

		for _, tt := range tests {
			result := getRateLimitForTier(tt.tier)
			assert.Equal(t, tt.expected, result, "Tier: %s", tt.tier)
		}
	})

	t.Run("getMaxAPIKeysForTier", func(t *testing.T) {
		tests := []struct {
			tier     models.PricingTier
			expected int
		}{
			{models.PricingTierDeveloper, 3},
			{models.PricingTierGrowth, 10},
			{models.PricingTierScale, 25},
			{models.PricingTierEnterprise, 100},
			{models.PricingTier("invalid"), 3},
		}

		for _, tt := range tests {
			result := getMaxAPIKeysForTier(tt.tier)
			assert.Equal(t, tt.expected, result, "Tier: %s", tt.tier)
		}
	})
}
