package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/port"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials  = errors.New("invalid email or password")
	ErrUserNotFound        = errors.New("user not found")
	ErrRefreshTokenExpired = errors.New("refresh token expired")
	ErrRefreshTokenRevoked = errors.New("refresh token revoked")
	ErrRefreshTokenInvalid = errors.New("refresh token invalid")
)

type AuthService struct {
	userRepo   port.UserRepository
	jwtService *JWTService
}

func NewAuthService(userRepo port.UserRepository, jwtService *JWTService) *AuthService {
	return &AuthService{
		userRepo:   userRepo,
		jwtService: jwtService,
	}
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*domain.LoginResponse, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	accessToken, err := s.jwtService.GenerateAccessToken(user.ID, user.Email)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.jwtService.GenerateRefreshToken(user.ID, user.Email)
	if err != nil {
		return nil, err
	}

	if err := s.storeRefreshToken(ctx, user.ID, refreshToken); err != nil {
		return nil, err
	}

	return &domain.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    s.jwtService.GetAccessTokenExpiry(),
		TokenType:    "Bearer",
	}, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshTokenStr string) (*domain.LoginResponse, error) {
	claims, err := s.jwtService.ValidateToken(refreshTokenStr)
	if err != nil {
		return nil, err
	}

	tokenRecord, err := s.userRepo.FindRefreshToken(ctx, refreshTokenStr, claims.UserID)
	if err != nil {
		return nil, ErrRefreshTokenInvalid
	}

	if tokenRecord.Revoked {
		return nil, ErrRefreshTokenRevoked
	}

	if time.Now().After(tokenRecord.ExpiresAt) {
		return nil, ErrRefreshTokenExpired
	}

	if err := s.userRepo.RevokeRefreshToken(ctx, tokenRecord.ID); err != nil {
		return nil, err
	}

	newAccessToken, err := s.jwtService.GenerateAccessToken(claims.UserID, claims.Email)
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := s.jwtService.GenerateRefreshToken(claims.UserID, claims.Email)
	if err != nil {
		return nil, err
	}

	if err := s.storeRefreshToken(ctx, claims.UserID, newRefreshToken); err != nil {
		return nil, err
	}

	return &domain.LoginResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    s.jwtService.GetAccessTokenExpiry(),
		TokenType:    "Bearer",
	}, nil
}

func (s *AuthService) storeRefreshToken(ctx context.Context, userID, token string) error {
	expiresAt := time.Now().Add(s.jwtService.GetRefreshTokenExpiry())
	return s.userRepo.SaveRefreshToken(ctx, uuid.New().String(), userID, token, expiresAt)
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}
