package service

import (
	"context"
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestHashPassword(t *testing.T) {
	password := "TestPassword123!"

	hash, err := HashPassword(password)

	require.NoError(t, err)
	assert.NotEmpty(t, hash)
	assert.NotEqual(t, password, hash)

	err = bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	assert.NoError(t, err)
}

func TestAuthService_Login_Success(t *testing.T) {
	email := "login@test.com"
	password := "Password123!"
	user := newTestUser(email, password)

	repo := &mockUserRepo{
		findByEmailFunc: func(_ context.Context, e string) (*domain.User, error) {
			if e == email {
				return user, nil
			}
			return nil, errors.New("not found")
		},
	}

	jwtService := NewJWTService("test-secret")
	authService := NewAuthService(repo, jwtService)

	response, err := authService.Login(context.Background(), email, password)

	require.NoError(t, err)
	assert.NotNil(t, response)
	assert.NotEmpty(t, response.AccessToken)
	assert.NotEmpty(t, response.RefreshToken)
	assert.Equal(t, "Bearer", response.TokenType)
	assert.Equal(t, int64(900), response.ExpiresIn)
}

func TestAuthService_Login_InvalidEmail(t *testing.T) {
	repo := &mockUserRepo{}

	jwtService := NewJWTService("test-secret")
	authService := NewAuthService(repo, jwtService)

	response, err := authService.Login(context.Background(), "nonexistent@test.com", "password")

	assert.Error(t, err)
	assert.Nil(t, response)
	assert.Equal(t, ErrInvalidCredentials, err)
}

func TestAuthService_Login_InvalidPassword(t *testing.T) {
	email := "wrongpass@test.com"
	user := newTestUser(email, "CorrectPassword123!")

	repo := &mockUserRepo{
		findByEmailFunc: func(_ context.Context, e string) (*domain.User, error) {
			return user, nil
		},
	}

	jwtService := NewJWTService("test-secret")
	authService := NewAuthService(repo, jwtService)

	response, err := authService.Login(context.Background(), email, "WrongPassword!")

	assert.Error(t, err)
	assert.Nil(t, response)
	assert.Equal(t, ErrInvalidCredentials, err)
}
