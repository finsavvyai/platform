package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// JWTService implements JWT authentication functionality
type JWTService struct {
	secretKey       []byte
	refreshKey      []byte
	issuer          string
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
	redisClient     *redis.Client
}

// JWTConfig holds JWT service configuration
type JWTConfig struct {
	SecretKey       string
	RefreshKey      string
	Issuer          string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	RedisClient     *redis.Client
}

// NewJWTService creates a new JWT service instance
func NewJWTService(config *JWTConfig) *JWTService {
	return &JWTService{
		secretKey:       []byte(config.SecretKey),
		refreshKey:      []byte(config.RefreshKey),
		issuer:          config.Issuer,
		accessTokenTTL:  config.AccessTokenTTL,
		refreshTokenTTL: config.RefreshTokenTTL,
		redisClient:     config.RedisClient,
	}
}

// GenerateJWT generates a new JWT token pair for the user
func (j *JWTService) GenerateJWT(ctx context.Context, user *models.User) (*interfaces.JWTTokens, error) {
	if user == nil {
		return nil, fmt.Errorf("user cannot be nil")
	}

	now := time.Now()
	accessExpiry := now.Add(j.accessTokenTTL)
	refreshExpiry := now.Add(j.refreshTokenTTL)

	// Generate access token
	accessClaims := &interfaces.JWTClaims{
		UserID:    user.UserID,
		Email:     user.Email,
		Role:      user.Role,
		IssuedAt:  now.Unix(),
		ExpiresAt: accessExpiry.Unix(),
		Subject:   user.UserID,
		Issuer:    j.issuer,
		Audience:  "quantumbeam-api",
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString(j.secretKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Generate refresh token
	refreshTokenID, err := j.generateTokenID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token ID: %w", err)
	}

	refreshClaims := jwt.MapClaims{
		"user_id":  user.UserID,
		"token_id": refreshTokenID,
		"iat":      now.Unix(),
		"exp":      refreshExpiry.Unix(),
		"iss":      j.issuer,
		"aud":      "quantumbeam-refresh",
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString(j.refreshKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	// Store refresh token in Redis (skip if Redis is not available)
	if j.redisClient != nil {
		refreshKey := fmt.Sprintf("refresh_token:%s", refreshTokenID)
		err = j.redisClient.Set(ctx, refreshKey, user.UserID, j.refreshTokenTTL).Err()
		if err != nil {
			return nil, fmt.Errorf("failed to store refresh token: %w", err)
		}
	}

	return &interfaces.JWTTokens{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		TokenType:    "Bearer",
		ExpiresIn:    int64(j.accessTokenTTL.Seconds()),
	}, nil
}

// ValidateJWT validates a JWT token and returns the claims
func (j *JWTService) ValidateJWT(ctx context.Context, tokenString string) (*interfaces.JWTClaims, error) {
	// Check if token is blacklisted (skip if Redis is not configured)
	if j.redisClient != nil {
		blacklistKey := fmt.Sprintf("blacklist:%s", tokenString)
		exists, err := j.redisClient.Exists(ctx, blacklistKey).Result()
		if err != nil {
			return nil, fmt.Errorf("failed to check token blacklist: %w", err)
		}
		if exists > 0 {
			return nil, fmt.Errorf("token has been revoked")
		}
	}

	token, err := jwt.ParseWithClaims(tokenString, &interfaces.JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return j.secretKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(*interfaces.JWTClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Verify token hasn't expired
	if time.Unix(claims.ExpiresAt, 0).Before(time.Now()) {
		return nil, fmt.Errorf("token has expired")
	}

	return claims, nil
}

// RefreshJWT generates a new access token using a refresh token
func (j *JWTService) RefreshJWT(ctx context.Context, refreshTokenString string) (*interfaces.JWTTokens, error) {
	// Parse refresh token
	token, err := jwt.Parse(refreshTokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return j.refreshKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse refresh token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid refresh token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid refresh token claims")
	}

	userID, ok := claims["user_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid user_id in refresh token")
	}

	tokenID, ok := claims["token_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid token_id in refresh token")
	}

	// Verify refresh token exists in Redis
	refreshKey := fmt.Sprintf("refresh_token:%s", tokenID)
	storedUserID, err := j.redisClient.Get(ctx, refreshKey).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("refresh token not found or expired")
		}
		return nil, fmt.Errorf("failed to verify refresh token: %w", err)
	}

	if storedUserID != userID {
		return nil, fmt.Errorf("refresh token user mismatch")
	}

	// For this implementation, we need the user object to generate new tokens
	// In a real implementation, you'd fetch the user from the database
	// For now, we'll create a minimal user object
	user := &models.User{
		UserID: userID,
		// Note: In production, you'd fetch the full user from database
	}

	// Generate new token pair
	newTokens, err := j.GenerateJWT(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate new tokens: %w", err)
	}

	// Remove old refresh token
	j.redisClient.Del(ctx, refreshKey)

	return newTokens, nil
}

// RevokeJWT revokes a JWT token by adding it to blacklist
func (j *JWTService) RevokeJWT(ctx context.Context, tokenString string) error {
	// Parse token to get expiration time
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return j.secretKey, nil
	})

	if err != nil {
		return fmt.Errorf("failed to parse token for revocation: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return fmt.Errorf("invalid token claims for revocation")
	}

	exp, ok := claims["exp"].(float64)
	if !ok {
		return fmt.Errorf("invalid expiration time in token")
	}

	expirationTime := time.Unix(int64(exp), 0)
	ttl := time.Until(expirationTime)

	// Only blacklist if token hasn't expired yet
	if ttl > 0 {
		blacklistKey := fmt.Sprintf("blacklist:%s", tokenString)
		err = j.redisClient.Set(ctx, blacklistKey, "revoked", ttl).Err()
		if err != nil {
			return fmt.Errorf("failed to blacklist token: %w", err)
		}
	}

	return nil
}

// generateTokenID generates a random token ID for refresh tokens
func (j *JWTService) generateTokenID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// AuthenticateJWT validates a JWT token and returns the associated user
func (j *JWTService) AuthenticateJWT(ctx context.Context, tokenString string) (*models.User, error) {
	claims, err := j.ValidateJWT(ctx, tokenString)
	if err != nil {
		return nil, err
	}

	// In a real implementation, you'd fetch the user from the database
	// For now, we'll create a user object from the claims
	user := &models.User{
		UserID: claims.UserID,
		Email:  claims.Email,
		Role:   claims.Role,
	}

	return user, nil
}
