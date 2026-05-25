package auth

import (
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"quantumbeam/internal/models"
)

func TestJWTService_GenerateJWT(t *testing.T) {
	// Setup Redis client for testing
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1, // Use test database
	})

	// Skip test if Redis is not available
	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available for testing")
	}

	defer redisClient.FlushDB(ctx)

	config := &JWTConfig{
		SecretKey:       "test-secret-key-32-characters-long",
		RefreshKey:      "test-refresh-key-32-characters-long",
		Issuer:          "quantumbeam-test",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		RedisClient:     redisClient,
	}

	jwtService := NewJWTService(config)

	user := &models.User{
		UserID: "test-user-123",
		Email:  "test@example.com",
		Role:   models.UserRoleDeveloper,
	}

	t.Run("successful token generation", func(t *testing.T) {
		tokens, err := jwtService.GenerateJWT(ctx, user)

		require.NoError(t, err)
		assert.NotEmpty(t, tokens.AccessToken)
		assert.NotEmpty(t, tokens.RefreshToken)
		assert.Equal(t, "Bearer", tokens.TokenType)
		assert.Equal(t, int64(900), tokens.ExpiresIn) // 15 minutes
	})

	t.Run("nil user error", func(t *testing.T) {
		tokens, err := jwtService.GenerateJWT(ctx, nil)

		assert.Error(t, err)
		assert.Nil(t, tokens)
		assert.Contains(t, err.Error(), "user cannot be nil")
	})
}

func TestJWTService_ValidateJWT(t *testing.T) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1,
	})

	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available for testing")
	}

	defer redisClient.FlushDB(ctx)

	config := &JWTConfig{
		SecretKey:       "test-secret-key-32-characters-long",
		RefreshKey:      "test-refresh-key-32-characters-long",
		Issuer:          "quantumbeam-test",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		RedisClient:     redisClient,
	}

	jwtService := NewJWTService(config)

	user := &models.User{
		UserID: "test-user-123",
		Email:  "test@example.com",
		Role:   models.UserRoleDeveloper,
	}

	t.Run("valid token validation", func(t *testing.T) {
		tokens, err := jwtService.GenerateJWT(ctx, user)
		require.NoError(t, err)

		claims, err := jwtService.ValidateJWT(ctx, tokens.AccessToken)

		require.NoError(t, err)
		assert.Equal(t, user.UserID, claims.UserID)
		assert.Equal(t, user.Email, claims.Email)
		assert.Equal(t, user.Role, claims.Role)
		assert.Equal(t, "quantumbeam-test", claims.Issuer)
		assert.Equal(t, "quantumbeam-api", claims.Audience)
	})

	t.Run("invalid token format", func(t *testing.T) {
		claims, err := jwtService.ValidateJWT(ctx, "invalid-token")

		assert.Error(t, err)
		assert.Nil(t, claims)
		assert.Contains(t, err.Error(), "failed to parse token")
	})

	t.Run("revoked token", func(t *testing.T) {
		tokens, err := jwtService.GenerateJWT(ctx, user)
		require.NoError(t, err)

		// Revoke the token
		err = jwtService.RevokeJWT(ctx, tokens.AccessToken)
		require.NoError(t, err)

		// Try to validate revoked token
		claims, err := jwtService.ValidateJWT(ctx, tokens.AccessToken)

		assert.Error(t, err)
		assert.Nil(t, claims)
		assert.Contains(t, err.Error(), "token has been revoked")
	})
}

func TestJWTService_RefreshJWT(t *testing.T) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1,
	})

	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available for testing")
	}

	defer redisClient.FlushDB(ctx)

	config := &JWTConfig{
		SecretKey:       "test-secret-key-32-characters-long",
		RefreshKey:      "test-refresh-key-32-characters-long",
		Issuer:          "quantumbeam-test",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		RedisClient:     redisClient,
	}

	jwtService := NewJWTService(config)

	user := &models.User{
		UserID: "test-user-123",
		Email:  "test@example.com",
		Role:   models.UserRoleDeveloper,
	}

	t.Run("successful token refresh", func(t *testing.T) {
		// Generate initial tokens
		initialTokens, err := jwtService.GenerateJWT(ctx, user)
		require.NoError(t, err)

		// Wait a moment to ensure different timestamps
		time.Sleep(100 * time.Millisecond)

		// Refresh tokens
		newTokens, err := jwtService.RefreshJWT(ctx, initialTokens.RefreshToken)

		require.NoError(t, err)
		assert.NotEmpty(t, newTokens.AccessToken)
		assert.NotEmpty(t, newTokens.RefreshToken)
		assert.NotEqual(t, initialTokens.AccessToken, newTokens.AccessToken)
		assert.NotEqual(t, initialTokens.RefreshToken, newTokens.RefreshToken)
	})

	t.Run("invalid refresh token", func(t *testing.T) {
		newTokens, err := jwtService.RefreshJWT(ctx, "invalid-refresh-token")

		assert.Error(t, err)
		assert.Nil(t, newTokens)
		assert.Contains(t, err.Error(), "failed to parse refresh token")
	})

	t.Run("expired refresh token", func(t *testing.T) {
		// Create a service with very short refresh token TTL
		shortConfig := &JWTConfig{
			SecretKey:       "test-secret-key-32-characters-long",
			RefreshKey:      "test-refresh-key-32-characters-long",
			Issuer:          "quantumbeam-test",
			AccessTokenTTL:  15 * time.Minute,
			RefreshTokenTTL: 1 * time.Millisecond, // Very short TTL
			RedisClient:     redisClient,
		}

		shortJwtService := NewJWTService(shortConfig)

		// Generate tokens
		tokens, err := shortJwtService.GenerateJWT(ctx, user)
		require.NoError(t, err)

		// Wait for refresh token to expire
		time.Sleep(10 * time.Millisecond)

		// Try to refresh
		newTokens, err := shortJwtService.RefreshJWT(ctx, tokens.RefreshToken)

		assert.Error(t, err)
		assert.Nil(t, newTokens)
		assert.Contains(t, err.Error(), "refresh token not found or expired")
	})
}

func TestJWTService_RevokeJWT(t *testing.T) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1,
	})

	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available for testing")
	}

	defer redisClient.FlushDB(ctx)

	config := &JWTConfig{
		SecretKey:       "test-secret-key-32-characters-long",
		RefreshKey:      "test-refresh-key-32-characters-long",
		Issuer:          "quantumbeam-test",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		RedisClient:     redisClient,
	}

	jwtService := NewJWTService(config)

	user := &models.User{
		UserID: "test-user-123",
		Email:  "test@example.com",
		Role:   models.UserRoleDeveloper,
	}

	t.Run("successful token revocation", func(t *testing.T) {
		tokens, err := jwtService.GenerateJWT(ctx, user)
		require.NoError(t, err)

		// Revoke token
		err = jwtService.RevokeJWT(ctx, tokens.AccessToken)
		assert.NoError(t, err)

		// Verify token is blacklisted
		claims, err := jwtService.ValidateJWT(ctx, tokens.AccessToken)
		assert.Error(t, err)
		assert.Nil(t, claims)
		assert.Contains(t, err.Error(), "token has been revoked")
	})

	t.Run("invalid token revocation", func(t *testing.T) {
		err := jwtService.RevokeJWT(ctx, "invalid-token")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to parse token for revocation")
	})
}

func TestJWTService_AuthenticateJWT(t *testing.T) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1,
	})

	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available for testing")
	}

	defer redisClient.FlushDB(ctx)

	config := &JWTConfig{
		SecretKey:       "test-secret-key-32-characters-long",
		RefreshKey:      "test-refresh-key-32-characters-long",
		Issuer:          "quantumbeam-test",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		RedisClient:     redisClient,
	}

	jwtService := NewJWTService(config)

	user := &models.User{
		UserID: "test-user-123",
		Email:  "test@example.com",
		Role:   models.UserRoleDeveloper,
	}

	t.Run("successful authentication", func(t *testing.T) {
		tokens, err := jwtService.GenerateJWT(ctx, user)
		require.NoError(t, err)

		authenticatedUser, err := jwtService.AuthenticateJWT(ctx, tokens.AccessToken)

		require.NoError(t, err)
		assert.Equal(t, user.UserID, authenticatedUser.UserID)
		assert.Equal(t, user.Email, authenticatedUser.Email)
		assert.Equal(t, user.Role, authenticatedUser.Role)
	})

	t.Run("authentication with invalid token", func(t *testing.T) {
		authenticatedUser, err := jwtService.AuthenticateJWT(ctx, "invalid-token")

		assert.Error(t, err)
		assert.Nil(t, authenticatedUser)
	})
}

func TestJWTService_generateTokenID(t *testing.T) {
	jwtService := &JWTService{}

	t.Run("generates unique token IDs", func(t *testing.T) {
		id1, err1 := jwtService.generateTokenID()
		id2, err2 := jwtService.generateTokenID()

		assert.NoError(t, err1)
		assert.NoError(t, err2)
		assert.NotEmpty(t, id1)
		assert.NotEmpty(t, id2)
		assert.NotEqual(t, id1, id2)
		assert.Len(t, id1, 32) // 16 bytes = 32 hex characters
		assert.Len(t, id2, 32)
	})
}
