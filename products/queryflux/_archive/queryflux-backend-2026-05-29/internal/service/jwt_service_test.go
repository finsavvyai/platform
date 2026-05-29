package service

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewJWTService(t *testing.T) {
	secret := "test-secret"
	service := NewJWTService(secret)

	assert.NotNil(t, service)
	assert.Equal(t, []byte(secret), service.secret)
}

func TestGenerateAccessToken(t *testing.T) {
	service := NewJWTService("test-secret")
	userID := "user-123"
	email := "test@example.com"

	token, err := service.GenerateAccessToken(userID, email)

	require.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := service.ValidateToken(token)
	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, email, claims.Email)
}

func TestGenerateRefreshToken(t *testing.T) {
	service := NewJWTService("test-secret")
	userID := "user-456"
	email := "refresh@example.com"

	token, err := service.GenerateRefreshToken(userID, email)

	require.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := service.ValidateToken(token)
	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, email, claims.Email)
}

func TestValidateToken_Success(t *testing.T) {
	service := NewJWTService("test-secret")
	userID := "user-789"
	email := "valid@example.com"

	token, err := service.GenerateAccessToken(userID, email)
	require.NoError(t, err)

	claims, err := service.ValidateToken(token)

	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, email, claims.Email)
}

func TestValidateToken_InvalidToken(t *testing.T) {
	service := NewJWTService("test-secret")

	claims, err := service.ValidateToken("invalid-token")

	assert.Error(t, err)
	assert.Nil(t, claims)
	assert.Equal(t, ErrInvalidToken, err)
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	service := NewJWTService("test-secret")

	now := time.Now().Add(-1 * time.Hour)
	claims := Claims{
		UserID: "user-expired",
		Email:  "expired@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now.Add(-2 * time.Hour)),
			NotBefore: jwt.NewNumericDate(now.Add(-2 * time.Hour)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(service.secret)
	require.NoError(t, err)

	validatedClaims, err := service.ValidateToken(tokenString)

	assert.Error(t, err)
	assert.Nil(t, validatedClaims)
	assert.Equal(t, ErrTokenExpired, err)
}

func TestValidateToken_InvalidSignature(t *testing.T) {
	service := NewJWTService("test-secret")
	wrongService := NewJWTService("wrong-secret")

	token, err := wrongService.GenerateAccessToken("user-123", "test@example.com")
	require.NoError(t, err)

	claims, err := service.ValidateToken(token)

	assert.Error(t, err)
	assert.Nil(t, claims)
}

func TestValidateToken_WrongSigningMethod(t *testing.T) {
	service := NewJWTService("test-secret")

	now := time.Now()
	claims := Claims{
		UserID: "user-wrong",
		Email:  "wrong@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	tokenString, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)

	validatedClaims, err := service.ValidateToken(tokenString)

	assert.Error(t, err)
	assert.Nil(t, validatedClaims)
}

func TestGetAccessTokenExpiry(t *testing.T) {
	service := NewJWTService("test-secret")

	expiry := service.GetAccessTokenExpiry()

	assert.Equal(t, int64(900), expiry)
}

func TestGetRefreshTokenExpiry(t *testing.T) {
	service := NewJWTService("test-secret")

	expiry := service.GetRefreshTokenExpiry()

	assert.Equal(t, RefreshTokenExpiry, expiry)
	assert.Equal(t, 7*24*time.Hour, expiry)
}

