package auth

import (
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// Integration tests for the complete authentication system
func TestAuthenticationIntegration(t *testing.T) {
	// Setup test database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Auto-migrate all schemas
	err = db.AutoMigrate(&models.User{}, &models.APIKey{}, &SSOConfig{}, &SSOSession{})
	require.NoError(t, err)

	// Setup Redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Test database
	})

	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available for integration testing")
	}
	defer redisClient.FlushDB(ctx)

	// Setup services
	jwtConfig := &JWTConfig{
		SecretKey:       "integration-test-secret-key-32-chars",
		RefreshKey:      "integration-test-refresh-key-32-chars",
		Issuer:          "quantumbeam-integration-test",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		RedisClient:     redisClient,
	}

	jwtService := NewJWTService(jwtConfig)

	mockRateLimit := &MockRateLimitService{}
	mockRateLimit.On("CheckRateLimit", ctx, "api_key:test-key-id", 100, 60).
		Return(&interfaces.RateLimitResult{
			Allowed:   true,
			Remaining: 99,
			ResetTime: time.Now().Add(time.Minute).Unix(),
		}, nil)

	apiKeyService := NewAPIKeyService(&APIKeyConfig{
		DB:               db,
		RedisClient:      redisClient,
		RateLimitService: mockRateLimit,
	})

	mockUserService := &MockUserService{}
	ssoService := NewSSOService(&SSOServiceConfig{
		DB:          db,
		JWTService:  jwtService,
		UserService: mockUserService,
	})

	t.Run("Complete JWT Authentication Flow", func(t *testing.T) {
		// Create test user
		user := &models.User{
			UserID:    "integration-user-123",
			Email:     "integration@example.com",
			Role:      models.UserRoleDeveloper,
			FirstName: "Integration",
			LastName:  "Test",
			IsActive:  true,
		}
		err := db.Create(user).Error
		require.NoError(t, err)

		// 1. Generate JWT tokens
		tokens, err := jwtService.GenerateJWT(ctx, user)
		require.NoError(t, err)
		assert.NotEmpty(t, tokens.AccessToken)
		assert.NotEmpty(t, tokens.RefreshToken)

		// 2. Validate access token
		claims, err := jwtService.ValidateJWT(ctx, tokens.AccessToken)
		require.NoError(t, err)
		assert.Equal(t, user.UserID, claims.UserID)
		assert.Equal(t, user.Email, claims.Email)
		assert.Equal(t, user.Role, claims.Role)

		// 3. Authenticate using JWT
		authenticatedUser, err := jwtService.AuthenticateJWT(ctx, tokens.AccessToken)
		require.NoError(t, err)
		assert.Equal(t, user.UserID, authenticatedUser.UserID)

		// 4. Refresh tokens
		newTokens, err := jwtService.RefreshJWT(ctx, tokens.RefreshToken)
		require.NoError(t, err)
		assert.NotEqual(t, tokens.AccessToken, newTokens.AccessToken)
		assert.NotEqual(t, tokens.RefreshToken, newTokens.RefreshToken)

		// 5. Validate new access token
		newClaims, err := jwtService.ValidateJWT(ctx, newTokens.AccessToken)
		require.NoError(t, err)
		assert.Equal(t, user.UserID, newClaims.UserID)

		// 6. Revoke old access token
		err = jwtService.RevokeJWT(ctx, tokens.AccessToken)
		require.NoError(t, err)

		// 7. Verify old token is invalid
		_, err = jwtService.ValidateJWT(ctx, tokens.AccessToken)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "token has been revoked")

		// 8. Verify new token still works
		_, err = jwtService.ValidateJWT(ctx, newTokens.AccessToken)
		assert.NoError(t, err)
	})

	t.Run("Complete API Key Authentication Flow", func(t *testing.T) {
		// Create test user
		user := &models.User{
			UserID:   "api-key-user-456",
			Email:    "apikey@example.com",
			Role:     models.UserRoleEnterprise,
			IsActive: true,
		}
		err := db.Create(user).Error
		require.NoError(t, err)

		// 1. Generate API key
		keyResponse, err := apiKeyService.GenerateAPIKey(ctx, user.UserID, models.PricingTierEnterprise, "Integration Test Key")
		require.NoError(t, err)
		assert.NotEmpty(t, keyResponse.Key)
		assert.Equal(t, models.PricingTierEnterprise, keyResponse.UsageTier)

		// 2. Validate API key
		validatedKey, err := apiKeyService.ValidateAPIKey(ctx, keyResponse.Key)
		require.NoError(t, err)
		assert.Equal(t, keyResponse.KeyID, validatedKey.KeyID)
		assert.Equal(t, user.UserID, validatedKey.UserID)
		assert.True(t, validatedKey.IsValid())

		// 3. List user's API keys
		userKeys, err := apiKeyService.ListAPIKeys(ctx, user.UserID)
		require.NoError(t, err)
		assert.Len(t, userKeys, 1)
		assert.Equal(t, keyResponse.KeyID, userKeys[0].KeyID)

		// 4. Rotate API key
		rotatedKey, err := apiKeyService.RotateAPIKey(ctx, keyResponse.KeyID)
		require.NoError(t, err)
		assert.Equal(t, keyResponse.KeyID, rotatedKey.KeyID)
		assert.NotEqual(t, keyResponse.Key, rotatedKey.Key)

		// 5. Verify old key is invalid
		_, err = apiKeyService.ValidateAPIKey(ctx, keyResponse.Key)
		assert.Error(t, err)

		// 6. Verify new key is valid
		validatedRotatedKey, err := apiKeyService.ValidateAPIKey(ctx, rotatedKey.Key)
		require.NoError(t, err)
		assert.Equal(t, rotatedKey.KeyID, validatedRotatedKey.KeyID)

		// 7. Revoke API key
		err = apiKeyService.RevokeAPIKey(ctx, rotatedKey.KeyID)
		require.NoError(t, err)

		// 8. Verify revoked key is invalid
		_, err = apiKeyService.ValidateAPIKey(ctx, rotatedKey.Key)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "inactive or expired")
	})

	t.Run("Complete SSO Authentication Flow", func(t *testing.T) {
		// 1. Configure SSO provider
		ssoConfig := &interfaces.SSOConfig{
			Provider:    "integration-sso",
			EntityID:    "quantumbeam-integration",
			SSOUrl:      "https://integration.example.com/sso",
			Certificate: "-----BEGIN CERTIFICATE-----\nintegration-cert\n-----END CERTIFICATE-----",
			AttributeMap: map[string]string{
				"email":      "email",
				"first_name": "given_name",
				"last_name":  "family_name",
				"company":    "organization",
			},
			IsActive:        true,
			AutoCreateUsers: true,
		}

		err := ssoService.ConfigureSSO(ctx, ssoConfig)
		require.NoError(t, err)

		// 2. Verify SSO provider is listed
		providers, err := ssoService.GetSSOProviders(ctx)
		require.NoError(t, err)
		assert.Len(t, providers, 1)
		assert.Equal(t, "integration-sso", providers[0].Name)
		assert.True(t, providers[0].IsActive)

		// 3. Create SAML assertion for new user
		assertion := createSAMLAssertion("sso@example.com", "SSO", "User", "SSO Corp")

		// Mock user service for SSO flow
		mockUserService.On("GetUserByEmail", ctx, "sso@example.com").
			Return((*models.User)(nil), gorm.ErrRecordNotFound)

		mockUserService.On("CreateUser", ctx, mock.AnythingOfType("*models.User")).
			Return(nil).Run(func(args mock.Arguments) {
			user := args.Get(1).(*models.User)
			user.UserID = "sso-user-789"
		})

		mockUserService.On("UpdateUser", ctx, mock.AnythingOfType("*models.User")).
			Return(nil)

		// 4. Process SSO login
		ssoResult, err := ssoService.ProcessSSOLogin(ctx, "integration-sso", assertion)
		require.NoError(t, err)
		assert.True(t, ssoResult.IsNewUser)
		assert.Equal(t, "sso@example.com", ssoResult.User.Email)
		assert.Equal(t, "SSO", ssoResult.User.FirstName)
		assert.NotNil(t, ssoResult.Tokens)

		// 5. Validate SSO assertion independently
		userInfo, err := ssoService.ValidateSSOAssertion(ctx, "integration-sso", assertion)
		require.NoError(t, err)
		assert.Equal(t, "sso@example.com", userInfo.Email)
		assert.Equal(t, "SSO", userInfo.FirstName)

		// 6. Test existing user SSO login
		existingUser := &models.User{
			UserID:   "existing-sso-user",
			Email:    "existing-sso@example.com",
			Role:     models.UserRoleDeveloper,
			IsActive: true,
		}

		existingAssertion := createSAMLAssertion("existing-sso@example.com", "Existing", "User", "Existing Corp")

		mockUserService.On("GetUserByEmail", ctx, "existing-sso@example.com").
			Return(existingUser, nil)

		mockUserService.On("UpdateUser", ctx, mock.AnythingOfType("*models.User")).
			Return(nil)

		existingSSOResult, err := ssoService.ProcessSSOLogin(ctx, "integration-sso", existingAssertion)
		require.NoError(t, err)
		assert.False(t, existingSSOResult.IsNewUser)
		assert.Equal(t, existingUser.UserID, existingSSOResult.User.UserID)

		mockUserService.AssertExpectations(t)
	})

	t.Run("Cross-Service Authentication Integration", func(t *testing.T) {
		// Create user through SSO, then generate API key, then use JWT

		// 1. SSO Configuration
		ssoConfig := &interfaces.SSOConfig{
			Provider:        "cross-service-sso",
			SSOUrl:          "https://cross.example.com/sso",
			IsActive:        true,
			AutoCreateUsers: true,
			AttributeMap: map[string]string{
				"email": "email",
			},
		}
		err := ssoService.ConfigureSSO(ctx, ssoConfig)
		require.NoError(t, err)

		// 2. Create user via SSO
		assertion := createSAMLAssertion("cross@example.com", "Cross", "Service", "Cross Corp")

		mockUserService.On("GetUserByEmail", ctx, "cross@example.com").
			Return((*models.User)(nil), gorm.ErrRecordNotFound)

		mockUserService.On("CreateUser", ctx, mock.AnythingOfType("*models.User")).
			Return(nil).Run(func(args mock.Arguments) {
			user := args.Get(1).(*models.User)
			user.UserID = "cross-service-user"
			// Save to database for API key generation
			db.Create(user)
		})

		mockUserService.On("UpdateUser", ctx, mock.AnythingOfType("*models.User")).
			Return(nil)

		ssoResult, err := ssoService.ProcessSSOLogin(ctx, "cross-service-sso", assertion)
		require.NoError(t, err)

		// 3. Generate API key for SSO-created user
		mockRateLimit.On("CheckRateLimit", ctx, "api_key:cross-api-key", 100, 60).
			Return(&interfaces.RateLimitResult{
				Allowed:   true,
				Remaining: 99,
				ResetTime: time.Now().Add(time.Minute).Unix(),
			}, nil)

		apiKeyResponse, err := apiKeyService.GenerateAPIKey(ctx, ssoResult.User.UserID, models.PricingTierDeveloper, "Cross Service Key")
		require.NoError(t, err)

		// 4. Validate API key
		validatedKey, err := apiKeyService.ValidateAPIKey(ctx, apiKeyResponse.Key)
		require.NoError(t, err)
		assert.Equal(t, ssoResult.User.UserID, validatedKey.UserID)

		// 5. Use JWT tokens from SSO
		jwtClaims, err := jwtService.ValidateJWT(ctx, ssoResult.Tokens.AccessToken)
		require.NoError(t, err)
		assert.Equal(t, ssoResult.User.UserID, jwtClaims.UserID)

		// 6. Refresh JWT tokens
		newTokens, err := jwtService.RefreshJWT(ctx, ssoResult.Tokens.RefreshToken)
		require.NoError(t, err)
		assert.NotEmpty(t, newTokens.AccessToken)

		mockUserService.AssertExpectations(t)
		mockRateLimit.AssertExpectations(t)
	})
}
