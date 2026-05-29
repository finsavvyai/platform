package service

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/queryflux/backend/internal/domain"
)

var (
	ErrInvalidToken     = errors.New("invalid token")
	ErrTokenExpired     = errors.New("token has expired")
	ErrInvalidSignature = errors.New("invalid token signature")
)

const (
	AccessTokenExpiry  = 15 * time.Minute
	RefreshTokenExpiry = 7 * 24 * time.Hour
)

type JWTService struct {
	secret []byte
}

func NewJWTService(secret string) *JWTService {
	return &JWTService{
		secret: []byte(secret),
	}
}

type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func (s *JWTService) GenerateAccessToken(userID, email string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(AccessTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

func (s *JWTService) GenerateRefreshToken(userID, email string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(RefreshTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

func (s *JWTService) ValidateToken(tokenString string) (*domain.JWTClaims, error) {
	token, err := jwt.ParseWithClaims(
		tokenString,
		&Claims{},
		func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, ErrInvalidSignature
			}
			return s.secret, nil
		},
	)

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidToken
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return &domain.JWTClaims{
			UserID: claims.UserID,
			Email:  claims.Email,
		}, nil
	}

	return nil, ErrInvalidToken
}

func (s *JWTService) GetAccessTokenExpiry() int64 {
	return int64(AccessTokenExpiry.Seconds())
}

func (s *JWTService) GetRefreshTokenExpiry() time.Duration {
	return RefreshTokenExpiry
}
