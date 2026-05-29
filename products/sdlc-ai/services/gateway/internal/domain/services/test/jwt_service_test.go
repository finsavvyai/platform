package test

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
)

// MockBlacklistService implements BlacklistService for testing
type MockBlacklistService struct {
	blacklisted   map[string]bool
	addCalled     bool
	isCalled      bool
	removeCalled  bool
	cleanupCalled bool
}

func NewMockBlacklistService() *MockBlacklistService {
	return &MockBlacklistService{
		blacklisted: make(map[string]bool),
	}
}

func (m *MockBlacklistService) AddToBlacklist(ctx context.Context, tokenID string, expiresAt time.Time) error {
	m.blacklisted[tokenID] = true
	m.addCalled = true
	return nil
}

func (m *MockBlacklistService) IsBlacklisted(ctx context.Context, tokenID string) (bool, error) {
	m.isCalled = true
	return m.blacklisted[tokenID], nil
}

func (m *MockBlacklistService) RemoveFromBlacklist(ctx context.Context, tokenID string) error {
	delete(m.blacklisted, tokenID)
	m.removeCalled = true
	return nil
}

func (m *MockBlacklistService) CleanupExpired(ctx context.Context) error {
	m.cleanupCalled = true
	return nil
}

func (m *MockBlacklistService) Reset() {
	m.blacklisted = make(map[string]bool)
	m.addCalled = false
	m.isCalled = false
	m.removeCalled = false
	m.cleanupCalled = false
}

// TestJWTService_GenerateTokenPair tests token pair generation
func TestJWTService_GenerateTokenPair(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Test data
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read", "write"}
	deviceFingerprint := "device-123"
	sessionID := "session-456"

	// Execute
	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		deviceFingerprint,
		sessionID,
	)

	// Assert
	require.NoError(t, err)
	assert.NotEmpty(t, tokenPair.AccessToken)
	assert.NotEmpty(t, tokenPair.RefreshToken)
	assert.Equal(t, "Bearer", tokenPair.TokenType)
	assert.True(t, tokenPair.ExpiresAt.After(time.Now()))
	assert.True(t, tokenPair.RefreshExpiresAt.After(tokenPair.ExpiresAt))
}

// TestJWTService_ValidateAccessToken tests access token validation
func TestJWTService_ValidateAccessToken(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Generate token pair
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read", "write"}

	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		"",
		"",
	)
	require.NoError(t, err)

	// Execute - validate access token
	tokenInfo, err := jwtService.ValidateToken(context.Background(), tokenPair.AccessToken, "access")

	// Assert
	require.NoError(t, err)
	assert.Equal(t, userID, tokenInfo.UserID)
	assert.Equal(t, tenantID, tokenInfo.TenantID)
	assert.Equal(t, email, tokenInfo.Email)
	assert.Equal(t, role, tokenInfo.Role)
	assert.Equal(t, permissions, tokenInfo.Permissions)
	assert.Equal(t, "access", tokenInfo.TokenType)
	assert.NotEmpty(t, tokenInfo.TokenID)
}

// TestJWTService_ValidateRefreshToken tests refresh token validation
func TestJWTService_ValidateRefreshToken(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Generate token pair
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read", "write"}

	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		"",
		"",
	)
	require.NoError(t, err)

	// Execute - validate refresh token
	tokenInfo, err := jwtService.ValidateToken(context.Background(), tokenPair.RefreshToken, "refresh")

	// Assert
	require.NoError(t, err)
	assert.Equal(t, userID, tokenInfo.UserID)
	assert.Equal(t, tenantID, tokenInfo.TenantID)
	assert.Equal(t, email, tokenInfo.Email)
	assert.Equal(t, role, tokenInfo.Role)
	assert.Equal(t, "refresh", tokenInfo.TokenType)
}

// TestJWTService_ValidateInvalidTokenType tests validation with wrong token type
func TestJWTService_ValidateInvalidTokenType(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Generate token pair
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read"}

	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		"",
		"",
	)
	require.NoError(t, err)

	// Execute - try to validate access token as refresh token
	_, err = jwtService.ValidateToken(context.Background(), tokenPair.AccessToken, "refresh")

	// Assert
	require.Error(t, err)
	assert.IsType(t, &services.TokenValidationError{}, err)
	validationErr := err.(*services.TokenValidationError)
	assert.Equal(t, "invalid_type", validationErr.Type)
}

// TestJWTService_ValidateExpiredToken tests validation of expired token
func TestJWTService_ValidateExpiredToken(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	// Create JWT service with very short expiry for testing
	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		1*time.Millisecond, // Very short expiry
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Generate token pair
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read"}

	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		"",
		"",
	)
	require.NoError(t, err)

	// Wait for token to expire
	time.Sleep(10 * time.Millisecond)

	// Execute - try to validate expired token
	_, err = jwtService.ValidateToken(context.Background(), tokenPair.AccessToken, "access")

	// Assert
	require.Error(t, err)
	assert.IsType(t, &services.TokenValidationError{}, err)
	validationErr := err.(*services.TokenValidationError)
	assert.Equal(t, "expired", validationErr.Type)
}

// TestJWTService_ValidateBlacklistedToken tests validation of blacklisted token
func TestJWTService_ValidateBlacklistedToken(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Generate token pair and extract token ID
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read"}

	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		"",
		"",
	)
	require.NoError(t, err)

	// Get token info to extract token ID
	tokenInfo, err := jwtService.ValidateToken(context.Background(), tokenPair.AccessToken, "access")
	require.NoError(t, err)

	// Add token to blacklist
	err = jwtService.RevokeToken(context.Background(), tokenInfo.TokenID, tokenInfo.ExpiresAt)
	require.NoError(t, err)
	assert.True(t, mockBlacklist.addCalled)

	// Reset mock blacklist called status
	mockBlacklist.isCalled = false

	// Execute - try to validate blacklisted token
	_, err = jwtService.ValidateToken(context.Background(), tokenPair.AccessToken, "access")

	// Assert
	require.Error(t, err)
	assert.IsType(t, &services.TokenValidationError{}, err)
	validationErr := err.(*services.TokenValidationError)
	assert.Equal(t, "blacklisted", validationErr.Type)
	assert.True(t, mockBlacklist.isCalled)
}

// TestJWTService_RefreshToken tests token refresh
func TestJWTService_RefreshToken(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Generate initial token pair
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read", "write"}
	deviceFingerprint := "device-123"
	sessionID := "session-456"

	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		deviceFingerprint,
		sessionID,
	)
	require.NoError(t, err)

	// Execute - refresh token
	newTokenPair, err := jwtService.RefreshToken(context.Background(), tokenPair.RefreshToken, deviceFingerprint)

	// Assert
	require.NoError(t, err)
	assert.NotEmpty(t, newTokenPair.AccessToken)
	assert.NotEmpty(t, newTokenPair.RefreshToken)
	assert.NotEqual(t, tokenPair.AccessToken, newTokenPair.AccessToken)
	assert.NotEqual(t, tokenPair.RefreshToken, newTokenPair.RefreshToken)
	assert.True(t, mockBlacklist.addCalled) // Old refresh token should be revoked
}

// TestJWTService_RefreshTokenWithDeviceMismatch tests refresh with device fingerprint mismatch
func TestJWTService_RefreshTokenWithDeviceMismatch(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Generate initial token pair with device fingerprint
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read"}
	deviceFingerprint := "device-123"

	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		deviceFingerprint,
		"",
	)
	require.NoError(t, err)

	// Execute - try to refresh with different device fingerprint
	_, err = jwtService.RefreshToken(context.Background(), tokenPair.RefreshToken, "different-device-456")

	// Assert
	require.Error(t, err)
	assert.IsType(t, &services.TokenValidationError{}, err)
	validationErr := err.(*services.TokenValidationError)
	assert.Equal(t, "device_mismatch", validationErr.Type)
}

// TestJWTService_GenerateSecureKey tests secure key generation
func TestJWTService_GenerateSecureKey(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()
	jwtService := services.NewJWTService(
		[]byte("test-key"),
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Test RSA key generation
	rsaKey, err := jwtService.GenerateSecureKey("RSA")
	require.NoError(t, err)
	assert.NotNil(t, rsaKey)
	assert.IsType(t, &rsa.PrivateKey{}, rsaKey)

	// Test ECDSA key generation
	ecdsaKey, err := jwtService.GenerateSecureKey("ECDSA")
	require.NoError(t, err)
	assert.NotNil(t, ecdsaKey)
	assert.IsType(t, &ecdsa.PrivateKey{}, ecdsaKey)

	// Test HMAC key generation
	hmacKey, err := jwtService.GenerateSecureKey("HMAC")
	require.NoError(t, err)
	assert.NotNil(t, hmacKey)
	assert.IsType(t, []byte{}, hmacKey)
	assert.Equal(t, 32, len(hmacKey.([]byte))) // 256 bits = 32 bytes

	// Test unsupported key type
	_, err = jwtService.GenerateSecureKey("UNSUPPORTED")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported key type")
}

// TestJWTService_GetKeyInfo tests key info retrieval
func TestJWTService_GetKeyInfo(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()
	jwtService := services.NewJWTService(
		[]byte("test-key"),
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Execute
	keyInfo := jwtService.GetKeyInfo()

	// Assert
	assert.NotEmpty(t, keyInfo.KeyID)
	assert.Equal(t, "HS256", keyInfo.Algorithm)
	assert.True(t, keyInfo.CreatedAt.Before(time.Now()))
	assert.True(t, keyInfo.ExpiresAt.After(keyInfo.CreatedAt))
}

// TestJWTService_RevokeToken tests token revocation
func TestJWTService_RevokeToken(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Generate token pair
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read"}

	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		"",
		"",
	)
	require.NoError(t, err)

	// Get token info to extract token ID
	tokenInfo, err := jwtService.ValidateToken(context.Background(), tokenPair.AccessToken, "access")
	require.NoError(t, err)

	// Execute - revoke token
	err = jwtService.RevokeToken(context.Background(), tokenInfo.TokenID, tokenInfo.ExpiresAt)

	// Assert
	require.NoError(t, err)
	assert.True(t, mockBlacklist.addCalled)
}

// TestJWTService_IsTokenRevoked tests token revocation check
func TestJWTService_IsTokenRevoked(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	tokenID := "test-token-id"
	expiresAt := time.Now().Add(1 * time.Hour)

	// Execute - check non-revoked token
	isRevoked, err := jwtService.IsTokenRevoked(context.Background(), tokenID)

	// Assert
	require.NoError(t, err)
	assert.False(t, isRevoked)
	assert.True(t, mockBlacklist.isCalled)

	// Reset
	mockBlacklist.Reset()

	// Revoke token
	err = jwtService.RevokeToken(context.Background(), tokenID, expiresAt)
	require.NoError(t, err)

	// Reset isCalled status
	mockBlacklist.isCalled = false

	// Execute - check revoked token
	isRevoked, err = jwtService.IsTokenRevoked(context.Background(), tokenID)

	// Assert
	require.NoError(t, err)
	assert.True(t, isRevoked)
	assert.True(t, mockBlacklist.isCalled)
}

// TestJWTService_InvalidToken tests invalid token handling
func TestJWTService_InvalidToken(t *testing.T) {
	// Setup
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	require.NoError(t, err)

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Execute - try to validate invalid token
	invalidTokens := []string{
		"",
		"invalid.token",
		"invalid.token.format",
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
	}

	for _, invalidToken := range invalidTokens {
		_, err := jwtService.ValidateToken(context.Background(), invalidToken, "access")

		// Assert
		require.Error(t, err, "Expected error for invalid token: %s", invalidToken)
		assert.IsType(t, &services.TokenValidationError{}, err)
	}
}

// TestHashDeviceFingerprint tests device fingerprint hashing
func TestHashDeviceFingerprint(t *testing.T) {
	// Test data
	fingerprint1 := "device-123-user-agent-456"
	fingerprint2 := "device-123-user-agent-456"
	fingerprint3 := "different-device"

	// Execute
	hash1 := services.HashDeviceFingerprint(fingerprint1)
	hash2 := services.HashDeviceFingerprint(fingerprint2)
	hash3 := services.HashDeviceFingerprint(fingerprint3)

	// Assert
	assert.NotEmpty(t, hash1)
	assert.Equal(t, hash1, hash2)    // Same input should produce same hash
	assert.NotEqual(t, hash1, hash3) // Different input should produce different hash
	assert.True(t, len(hash1) > 0)
}

// TestJWTService_MultipleAlgorithms tests JWT service with different algorithms
func TestJWTService_MultipleAlgorithms(t *testing.T) {
	mockBlacklist := NewMockBlacklistService()

	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read"}

	testCases := []struct {
		name      string
		algorithm jwa.SignatureAlgorithm
		keyGen    func() (interface{}, error)
	}{
		{
			name:      "HS256",
			algorithm: jwa.HS256,
			keyGen: func() (interface{}, error) {
				key := make([]byte, 32)
				_, err := rand.Read(key)
				return key, err
			},
		},
		{
			name:      "RS256",
			algorithm: jwa.RS256,
			keyGen: func() (interface{}, error) {
				return services.GenerateRSAKey(2048)
			},
		},
		{
			name:      "ES256",
			algorithm: jwa.ES256,
			keyGen: func() (interface{}, error) {
				return services.GenerateECDSAKey()
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Generate key
			key, err := tc.keyGen()
			require.NoError(t, err)

			// Create JWT service
			jwtService := services.NewJWTService(
				key,
				tc.algorithm,
				"sdlc-test",
				15*time.Minute,
				7*24*time.Hour,
				mockBlacklist,
				nil,
			)

			// Generate token pair
			tokenPair, err := jwtService.GenerateTokenPair(
				context.Background(),
				userID,
				tenantID,
				email,
				role,
				permissions,
				"",
				"",
			)
			require.NoError(t, err)

			// Validate token
			tokenInfo, err := jwtService.ValidateToken(context.Background(), tokenPair.AccessToken, "access")
			require.NoError(t, err)

			// Assert token content
			assert.Equal(t, userID, tokenInfo.UserID)
			assert.Equal(t, tenantID, tokenInfo.TenantID)
			assert.Equal(t, email, tokenInfo.Email)
			assert.Equal(t, role, tokenInfo.Role)
		})
	}
}

// Benchmark tests
func BenchmarkJWTService_GenerateTokenPair(b *testing.B) {
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	if err != nil {
		b.Fatal(err)
	}

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read", "write"}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := jwtService.GenerateTokenPair(
			context.Background(),
			userID,
			tenantID,
			email,
			role,
			permissions,
			"",
			"",
		)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkJWTService_ValidateToken(b *testing.B) {
	mockBlacklist := NewMockBlacklistService()

	// Generate HMAC key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	if err != nil {
		b.Fatal(err)
	}

	jwtService := services.NewJWTService(
		key,
		jwa.HS256,
		"sdlc-test",
		15*time.Minute,
		7*24*time.Hour,
		mockBlacklist,
		nil,
	)

	// Pre-generate token
	userID := uuid.New()
	tenantID := uuid.New()
	email := "test@example.com"
	role := "user"
	permissions := []string{"read", "write"}

	tokenPair, err := jwtService.GenerateTokenPair(
		context.Background(),
		userID,
		tenantID,
		email,
		role,
		permissions,
		"",
		"",
	)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := jwtService.ValidateToken(context.Background(), tokenPair.AccessToken, "access")
		if err != nil {
			b.Fatal(err)
		}
	}
}
