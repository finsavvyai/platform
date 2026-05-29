package service

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthService_RefreshToken_Success(t *testing.T) {
	email := "refresh@test.com"
	password := "Password123!"
	user := newTestUser(email, password)
	repo, _ := newMockRepoWithTokenStore(user)

	jwtService := NewJWTService("test-secret")
	authService := NewAuthService(repo, jwtService)

	loginResponse, err := authService.Login(context.Background(), email, password)
	require.NoError(t, err)

	time.Sleep(time.Second)

	refreshResponse, err := authService.RefreshToken(context.Background(), loginResponse.RefreshToken)

	require.NoError(t, err)
	assert.NotNil(t, refreshResponse)
	assert.NotEmpty(t, refreshResponse.AccessToken)
	assert.NotEmpty(t, refreshResponse.RefreshToken)
	assert.Equal(t, "Bearer", refreshResponse.TokenType)
	assert.Equal(t, int64(900), refreshResponse.ExpiresIn)
}

func TestAuthService_RefreshToken_InvalidToken(t *testing.T) {
	repo := &mockUserRepo{}
	jwtService := NewJWTService("test-secret")
	authService := NewAuthService(repo, jwtService)

	response, err := authService.RefreshToken(context.Background(), "invalid-token")

	assert.Error(t, err)
	assert.Nil(t, response)
}

func TestAuthService_RefreshToken_NotInDatabase(t *testing.T) {
	repo := &mockUserRepo{}
	jwtService := NewJWTService("test-secret")
	authService := NewAuthService(repo, jwtService)

	validToken, err := jwtService.GenerateRefreshToken("non-existent-user", "test@example.com")
	require.NoError(t, err)

	response, err := authService.RefreshToken(context.Background(), validToken)

	assert.Error(t, err)
	assert.Nil(t, response)
	assert.Equal(t, ErrRefreshTokenInvalid, err)
}

func TestAuthService_RefreshToken_Revoked(t *testing.T) {
	email := "revoked@test.com"
	password := "Password123!"
	user := newTestUser(email, password)
	repo, storedTokens := newMockRepoWithTokenStore(user)

	jwtService := NewJWTService("test-secret")
	authService := NewAuthService(repo, jwtService)

	loginResponse, err := authService.Login(context.Background(), email, password)
	require.NoError(t, err)

	storedTokens[loginResponse.RefreshToken].Revoked = true

	response, err := authService.RefreshToken(context.Background(), loginResponse.RefreshToken)

	assert.Error(t, err)
	assert.Nil(t, response)
	assert.Equal(t, ErrRefreshTokenRevoked, err)
}
