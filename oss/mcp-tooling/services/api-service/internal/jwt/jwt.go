package jwt

import (
	"crypto/rand"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/models"
	"golang.org/x/crypto/bcrypt"
)

// Service handles JWT token operations
type Service struct {
	config *config.Config
}

// NewService creates a new JWT service
func NewService(cfg *config.Config) *Service {
	return &Service{
		config: cfg,
	}
}

// Claims represents the JWT claims structure
type Claims struct {
	UserID    string          `json:"user_id"`
	Email     string          `json:"email"`
	Role      models.UserRole `json:"role"`
	TokenType string          `json:"token_type"` // "access" or "refresh"
	jwt.RegisteredClaims
}

// TokenPair represents an access and refresh token pair
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	ExpiresIn    int       `json:"expires_in"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// GenerateTokenPair generates an access and refresh token pair
func (s *Service) GenerateTokenPair(userID, email string, role models.UserRole) (*TokenPair, error) {
	// Generate access token (short-lived)
	accessToken, err := s.generateToken(userID, email, role, "access", s.getAccessTokenExpiry())
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate refresh token (long-lived)
	refreshToken, err := s.generateToken(userID, email, role, "refresh", s.getRefreshTokenExpiry())
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(s.getAccessTokenExpiry().Seconds()),
		ExpiresAt:    time.Now().Add(s.getAccessTokenExpiry()),
	}, nil
}

// GenerateAccessToken generates an access token
func (s *Service) GenerateAccessToken(userID, email string, role models.UserRole) (string, error) {
	return s.generateToken(userID, email, role, "access", s.getAccessTokenExpiry())
}

// GenerateRefreshToken generates a refresh token
func (s *Service) GenerateRefreshToken(userID, email string, role models.UserRole) (string, error) {
	return s.generateToken(userID, email, role, "refresh", s.getRefreshTokenExpiry())
}

// ValidateToken validates a JWT token and returns the claims
func (s *Service) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWT.Secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		// Check if token is expired
		if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
			return nil, fmt.Errorf("token expired")
		}
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}

// ValidateAccessToken validates an access token specifically
func (s *Service) ValidateAccessToken(tokenString string) (*Claims, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != "access" {
		return nil, fmt.Errorf("invalid token type, expected access token")
	}

	return claims, nil
}

// ValidateRefreshToken validates a refresh token specifically
func (s *Service) ValidateRefreshToken(tokenString string) (*Claims, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != "refresh" {
		return nil, fmt.Errorf("invalid token type, expected refresh token")
	}

	return claims, nil
}

// RefreshAccessToken generates a new access token from a refresh token
func (s *Service) RefreshAccessToken(refreshTokenString string) (*TokenPair, error) {
	// Validate the refresh token
	claims, err := s.ValidateRefreshToken(refreshTokenString)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Generate new token pair
	return s.GenerateTokenPair(claims.UserID, claims.Email, claims.Role)
}

// generateToken generates a JWT token with the specified parameters
func (s *Service) generateToken(userID, email string, role models.UserRole, tokenType string, expiry time.Duration) (string, error) {
	now := time.Now()
	claims := &Claims{
		UserID:    userID,
		Email:     email,
		Role:      role,
		TokenType: tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        s.generateTokenID(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(expiry)),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "mcpoverflow",
			Subject:   userID,
			Audience:  []string{"mcpoverflow-api"},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.config.JWT.Secret))
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// generateTokenID generates a unique token ID
func (s *Service) generateTokenID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

// getAccessTokenExpiry returns the access token expiry duration
func (s *Service) getAccessTokenExpiry() time.Duration {
	return 15 * time.Minute // 15 minutes for access tokens
}

// getRefreshTokenExpiry returns the refresh token expiry duration
func (s *Service) getRefreshTokenExpiry() time.Duration {
	return 7 * 24 * time.Hour // 7 days for refresh tokens
}

// ExtractTokenFromHeader extracts JWT token from Authorization header
func ExtractTokenFromHeader(authHeader string) (string, error) {
	if authHeader == "" {
		return "", fmt.Errorf("authorization header is empty")
	}

	const bearerPrefix = "Bearer "
	if len(authHeader) < len(bearerPrefix) || authHeader[:len(bearerPrefix)] != bearerPrefix {
		return "", fmt.Errorf("invalid authorization header format")
	}

	return authHeader[len(bearerPrefix):], nil
}

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(hash), nil
}

// CheckPasswordHash validates a password against its hash
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GetTokenMetadata extracts metadata from a token without full validation
func (s *Service) GetTokenMetadata(tokenString string) (*TokenMetadata, error) {
	token, _, err := jwt.NewParser().ParseUnverified(tokenString, &Claims{})
	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok {
		return &TokenMetadata{
			UserID:    claims.UserID,
			Email:     claims.Email,
			Role:      string(claims.Role),
			TokenType: claims.TokenType,
			ExpiresAt: claims.ExpiresAt.Time,
			IssuedAt:  claims.IssuedAt.Time,
		}, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}

// TokenMetadata contains extracted token information
type TokenMetadata struct {
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	TokenType string    `json:"token_type"`
	ExpiresAt time.Time `json:"expires_at"`
	IssuedAt  time.Time `json:"issued_at"`
}

// IsTokenExpired checks if a token is expired
func IsTokenExpired(expiresAt time.Time) bool {
	return time.Now().After(expiresAt)
}

// IsTokenNearExpiry checks if a token is near expiry (within 5 minutes)
func IsTokenNearExpiry(expiresAt time.Time) bool {
	return time.Until(expiresAt) < 5*time.Minute
}

// GenerateAPIToken generates a special API token
func (s *Service) GenerateAPIToken(userID, email string, scopes []string) (string, error) {
	now := time.Now()
	claims := &jwt.MapClaims{
		"user_id":    userID,
		"email":      email,
		"scopes":     scopes,
		"token_type": "api",
		"jti":        s.generateTokenID(),
		"iat":        jwt.NewNumericDate(now),
		"exp":        jwt.NewNumericDate(now.Add(365 * 24 * time.Hour)), // 1 year
		"nbf":        jwt.NewNumericDate(now),
		"iss":        "mcpoverflow",
		"sub":        userID,
		"aud":        []string{"mcpoverflow-api"},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.config.JWT.Secret))
	if err != nil {
		return "", fmt.Errorf("failed to sign API token: %w", err)
	}

	return tokenString, nil
}

// ValidateAPIToken validates an API token
func (s *Service) ValidateAPIToken(tokenString string) (*APITokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &APITokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWT.Secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse API token: %w", err)
	}

	if claims, ok := token.Claims.(*APITokenClaims); ok && token.Valid {
		if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
			return nil, fmt.Errorf("API token expired")
		}
		return claims, nil
	}

	return nil, fmt.Errorf("invalid API token claims")
}

// APITokenClaims represents claims for API tokens
type APITokenClaims struct {
	UserID    string   `json:"user_id"`
	Email     string   `json:"email"`
	Scopes    []string `json:"scopes"`
	TokenType string   `json:"token_type"`
	jwt.RegisteredClaims
}

// RevokeToken adds a token to the revocation list
// Note: This would typically use a database or cache to store revoked tokens
func (s *Service) RevokeToken(tokenID string) error {
	// TODO: Implement token revocation using database or cache
	// This would store the token ID in a revocation list
	return nil
}

// IsTokenRevoked checks if a token has been revoked
func (s *Service) IsTokenRevoked(tokenID string) bool {
	// TODO: Implement token revocation check
	// This would check the revocation list in database or cache
	return false
}
