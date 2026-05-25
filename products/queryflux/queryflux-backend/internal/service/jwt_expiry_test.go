package service

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAccessTokenExpiry_IsCorrect(t *testing.T) {
	svc := NewJWTService("test-secret")

	beforeGeneration := time.Now()
	token, err := svc.GenerateAccessToken("user-time-check", "time@example.com")
	require.NoError(t, err)

	parsedToken, err := jwt.ParseWithClaims(
		token, &Claims{},
		func(token *jwt.Token) (interface{}, error) {
			return svc.secret, nil
		},
	)
	require.NoError(t, err)

	claims, ok := parsedToken.Claims.(*Claims)
	require.True(t, ok)

	expectedExpiry := beforeGeneration.Add(AccessTokenExpiry)
	timeDiff := claims.ExpiresAt.Time.Sub(expectedExpiry)
	assert.True(t, timeDiff < 2*time.Second && timeDiff > -2*time.Second)
}

func TestRefreshTokenExpiry_IsCorrect(t *testing.T) {
	svc := NewJWTService("test-secret")

	beforeGeneration := time.Now()
	token, err := svc.GenerateRefreshToken("user-refresh-time", "refresh-time@example.com")
	require.NoError(t, err)

	parsedToken, err := jwt.ParseWithClaims(
		token, &Claims{},
		func(token *jwt.Token) (interface{}, error) {
			return svc.secret, nil
		},
	)
	require.NoError(t, err)

	claims, ok := parsedToken.Claims.(*Claims)
	require.True(t, ok)

	expectedExpiry := beforeGeneration.Add(RefreshTokenExpiry)
	timeDiff := claims.ExpiresAt.Time.Sub(expectedExpiry)
	assert.True(t, timeDiff < 2*time.Second && timeDiff > -2*time.Second)
}
