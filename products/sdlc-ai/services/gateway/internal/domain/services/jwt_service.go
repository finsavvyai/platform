//go:build ignore

package services

import (
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwt"
	"github.com/sirupsen/logrus"
)

// TokenPair represents a pair of access and refresh tokens
type TokenPair struct {
	AccessToken      string    `json:"access_token"`
	RefreshToken     string    `json:"refresh_token"`
	ExpiresAt        time.Time `json:"expires_at"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
	TokenType        string    `json:"token_type"`
}

// TokenClaims represents the claims stored in JWT tokens
type TokenClaims struct {
	UserID            string            `json:"user_id"`
	TenantID          string            `json:"tenant_id"`
	Email             string            `json:"email"`
	Role              string            `json:"role"`
	Permissions       []string          `json:"permissions"`
	TokenType         string            `json:"token_type"` // "access" or "refresh"
	TokenID           string            `json:"jti"`        // JWT ID for token tracking
	DeviceFingerprint string            `json:"device_fingerprint,omitempty"`
	SessionID         string            `json:"session_id,omitempty"`
	IssuedAt          time.Time         `json:"iat"`
	ExpiresAt         time.Time         `json:"exp"`
	NotBefore         time.Time         `json:"nbf"`
	Issuer            string            `json:"iss"`
	Subject           string            `json:"sub"`
	Audience          []string          `json:"aud,omitempty"`
	SecurityContext   map[string]string `json:"security_context,omitempty"`
}

// TokenInfo represents information extracted from a valid token
type TokenInfo struct {
	UserID            uuid.UUID         `json:"user_id"`
	TenantID          uuid.UUID         `json:"tenant_id"`
	Email             string            `json:"email"`
	Role              string            `json:"role"`
	Permissions       []string          `json:"permissions"`
	TokenID           string            `json:"token_id"`
	DeviceFingerprint string            `json:"device_fingerprint,omitempty"`
	SessionID         string            `json:"session_id,omitempty"`
	TokenType         string            `json:"token_type"`
	ExpiresAt         time.Time         `json:"expires_at"`
	IssuedAt          time.Time         `json:"issued_at"`
	SecurityContext   map[string]string `json:"security_context,omitempty"`
}

// TokenValidationError represents different types of token validation errors
type TokenValidationError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func (e *TokenValidationError) Error() string {
	return e.Message
}

// Common validation error types
var (
	ErrTokenExpired          = &TokenValidationError{Type: "expired", Message: "token has expired"}
	ErrTokenNotValidYet      = &TokenValidationError{Type: "not_valid_yet", Message: "token is not valid yet"}
	ErrTokenInvalid          = &TokenValidationError{Type: "invalid", Message: "token is invalid"}
	ErrTokenMalformed        = &TokenValidationError{Type: "malformed", Message: "token is malformed"}
	ErrTokenBlacklisted      = &TokenValidationError{Type: "blacklisted", Message: "token has been revoked"}
	ErrTokenTypeInvalid      = &TokenValidationError{Type: "invalid_type", Message: "invalid token type"}
	ErrTokenSignatureInvalid = &TokenValidationError{Type: "invalid_signature", Message: "token signature is invalid"}
)

// JWTService interface defines the contract for JWT operations
type JWTService interface {
	// GenerateTokenPair creates a new access and refresh token pair
	GenerateTokenPair(ctx context.Context, userID, tenantID uuid.UUID, email, role string, permissions []string, deviceFingerprint, sessionID string) (*TokenPair, error)

	// ValidateToken validates a JWT token and returns token information
	ValidateToken(ctx context.Context, tokenString string, expectedType string) (*TokenInfo, error)

	// RefreshToken generates a new token pair using a valid refresh token
	RefreshToken(ctx context.Context, refreshTokenString string, deviceFingerprint string) (*TokenPair, error)

	// RevokeToken adds a token to the blacklist
	RevokeToken(ctx context.Context, tokenID string, expiresAt time.Time) error

	// IsTokenRevoked checks if a token has been revoked
	IsTokenRevoked(ctx context.Context, tokenID string) (bool, error)

	// GenerateSecureKey generates a new secure signing key
	GenerateSecureKey(keyType string) (interface{}, error)

	// RotateKeys performs key rotation for JWT signing
	RotateKeys(ctx context.Context) error

	// GetKeyInfo returns information about the current signing key
	GetKeyInfo() KeyInfo
}

// KeyInfo represents information about the signing key
type KeyInfo struct {
	KeyID     string    `json:"key_id"`
	Algorithm string    `json:"algorithm"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

// BlacklistService interface for token blacklisting
type BlacklistService interface {
	AddToBlacklist(ctx context.Context, tokenID string, expiresAt time.Time) error
	IsBlacklisted(ctx context.Context, tokenID string) (bool, error)
	RemoveFromBlacklist(ctx context.Context, tokenID string) error
	CleanupExpired(ctx context.Context) error
}

// jwtService implements the JWTService interface
type jwtService struct {
	signingKey       interface{}
	signingAlgorithm jwa.SignatureAlgorithm
	issuer           string
	accessTokenTTL   time.Duration
	refreshTokenTTL  time.Duration
	blacklistService BlacklistService
	keyID            string
	logger           *logrus.Logger
}

// NewJWTService creates a new JWT service instance
func NewJWTService(
	signingKey interface{},
	signingAlgorithm jwa.SignatureAlgorithm,
	issuer string,
	accessTokenTTL, refreshTokenTTL time.Duration,
	blacklistService BlacklistService,
	logger *logrus.Logger,
) JWTService {
	if logger == nil {
		logger = logrus.New()
	}

	keyID := uuid.New().String()

	return &jwtService{
		signingKey:       signingKey,
		signingAlgorithm: signingAlgorithm,
		issuer:           issuer,
		accessTokenTTL:   accessTokenTTL,
		refreshTokenTTL:  refreshTokenTTL,
		blacklistService: blacklistService,
		keyID:            keyID,
		logger:           logger,
	}
}

// GenerateTokenPair creates a new access and refresh token pair
func (s *jwtService) GenerateTokenPair(
	ctx context.Context,
	userID, tenantID uuid.UUID,
	email, role string,
	permissions []string,
	deviceFingerprint, sessionID string,
) (*TokenPair, error) {
	now := time.Now()

	// Generate unique token IDs
	accessTokenID := uuid.New().String()
	refreshTokenID := uuid.New().String()

	// Create security context
	securityContext := map[string]string{
		"tenant_id":  tenantID.String(),
		"created_by": "jwt_service",
		"version":    "1.0",
	}

	// Create access token claims
	accessClaims := TokenClaims{
		UserID:            userID.String(),
		TenantID:          tenantID.String(),
		Email:             email,
		Role:              role,
		Permissions:       permissions,
		TokenType:         "access",
		TokenID:           accessTokenID,
		DeviceFingerprint: deviceFingerprint,
		SessionID:         sessionID,
		IssuedAt:          now,
		ExpiresAt:         now.Add(s.accessTokenTTL),
		NotBefore:         now,
		Issuer:            s.issuer,
		Subject:           userID.String(),
		Audience:          []string{s.issuer},
		SecurityContext:   securityContext,
	}

	// Create refresh token claims
	refreshClaims := TokenClaims{
		UserID:            userID.String(),
		TenantID:          tenantID.String(),
		Email:             email,
		Role:              role,
		Permissions:       permissions,
		TokenType:         "refresh",
		TokenID:           refreshTokenID,
		DeviceFingerprint: deviceFingerprint,
		SessionID:         sessionID,
		IssuedAt:          now,
		ExpiresAt:         now.Add(s.refreshTokenTTL),
		NotBefore:         now,
		Issuer:            s.issuer,
		Subject:           userID.String(),
		Audience:          []string{s.issuer},
		SecurityContext:   securityContext,
	}

	// Sign access token
	signedAccessToken, err := s.signToken(accessClaims)
	if err != nil {
		s.logger.WithError(err).Error("Failed to sign access token")
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Sign refresh token
	signedRefreshToken, err := s.signToken(refreshClaims)
	if err != nil {
		s.logger.WithError(err).Error("Failed to sign refresh token")
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	tokenPair := &TokenPair{
		AccessToken:      signedAccessToken,
		RefreshToken:     signedRefreshToken,
		ExpiresAt:        accessClaims.ExpiresAt,
		RefreshExpiresAt: refreshClaims.ExpiresAt,
		TokenType:        "Bearer",
	}

	s.logger.WithFields(logrus.Fields{
		"user_id":    userID.String(),
		"tenant_id":  tenantID.String(),
		"token_type": "token_pair",
	}).Info("Generated new token pair")

	return tokenPair, nil
}

// ValidateToken validates a JWT token and returns token information
func (s *jwtService) ValidateToken(ctx context.Context, tokenString string, expectedType string) (*TokenInfo, error) {
	// Parse and verify token
	token, err := jwt.Parse([]byte(tokenString), jwt.WithKey(s.signingAlgorithm, s.signingKey))
	if err != nil {
		s.logger.WithError(err).Debug("Token parsing failed")
		return nil, s.mapJWTError(err)
	}

	// Extract claims
	claims, err := s.extractClaims(token)
	if err != nil {
		s.logger.WithError(err).Debug("Failed to extract claims")
		return nil, err
	}

	// Validate token type
	if expectedType != "" && claims.TokenType != expectedType {
		s.logger.WithField("expected_type", expectedType).WithField("actual_type", claims.TokenType).Debug("Invalid token type")
		return nil, ErrTokenTypeInvalid
	}

	// Check if token is blacklisted
	if s.blacklistService != nil {
		blacklisted, err := s.blacklistService.IsBlacklisted(ctx, claims.TokenID)
		if err != nil {
			s.logger.WithError(err).Error("Failed to check blacklist")
			return nil, fmt.Errorf("failed to check blacklist: %w", err)
		}
		if blacklisted {
			s.logger.WithField("token_id", claims.TokenID).Debug("Token is blacklisted")
			return nil, ErrTokenBlacklisted
		}
	}

	// Convert to TokenInfo
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		s.logger.WithError(err).Debug("Invalid user ID in token")
		return nil, ErrTokenInvalid
	}

	tenantID, err := uuid.Parse(claims.TenantID)
	if err != nil {
		s.logger.WithError(err).Debug("Invalid tenant ID in token")
		return nil, ErrTokenInvalid
	}

	tokenInfo := &TokenInfo{
		UserID:            userID,
		TenantID:          tenantID,
		Email:             claims.Email,
		Role:              claims.Role,
		Permissions:       claims.Permissions,
		TokenID:           claims.TokenID,
		DeviceFingerprint: claims.DeviceFingerprint,
		SessionID:         claims.SessionID,
		TokenType:         claims.TokenType,
		ExpiresAt:         claims.ExpiresAt,
		IssuedAt:          claims.IssuedAt,
		SecurityContext:   claims.SecurityContext,
	}

	return tokenInfo, nil
}

// RefreshToken generates a new token pair using a valid refresh token
func (s *jwtService) RefreshToken(ctx context.Context, refreshTokenString string, deviceFingerprint string) (*TokenPair, error) {
	// Validate refresh token
	tokenInfo, err := s.ValidateToken(ctx, refreshTokenString, "refresh")
	if err != nil {
		s.logger.WithError(err).Debug("Invalid refresh token")
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Validate device fingerprint if present
	if tokenInfo.DeviceFingerprint != "" && tokenInfo.DeviceFingerprint != deviceFingerprint {
		s.logger.WithFields(logrus.Fields{
			"expected": tokenInfo.DeviceFingerprint,
			"provided": deviceFingerprint,
		}).Debug("Device fingerprint mismatch")
		return nil, ErrTokenInvalid
	}

	// Revoke the old refresh token
	err = s.RevokeToken(ctx, tokenInfo.TokenID, tokenInfo.ExpiresAt)
	if err != nil {
		s.logger.WithError(err).Warn("Failed to revoke old refresh token")
		// Continue anyway, as this is a non-critical error
	}

	// Generate new token pair
	return s.GenerateTokenPair(
		ctx,
		tokenInfo.UserID,
		tokenInfo.TenantID,
		tokenInfo.Email,
		tokenInfo.Role,
		tokenInfo.Permissions,
		tokenInfo.DeviceFingerprint,
		tokenInfo.SessionID,
	)
}

// RevokeToken adds a token to the blacklist
func (s *jwtService) RevokeToken(ctx context.Context, tokenID string, expiresAt time.Time) error {
	if s.blacklistService == nil {
		return nil
	}

	err := s.blacklistService.AddToBlacklist(ctx, tokenID, expiresAt)
	if err != nil {
		s.logger.WithError(err).WithField("token_id", tokenID).Error("Failed to revoke token")
		return fmt.Errorf("failed to revoke token: %w", err)
	}

	s.logger.WithField("token_id", tokenID).Info("Token revoked")
	return nil
}

// IsTokenRevoked checks if a token has been revoked
func (s *jwtService) IsTokenRevoked(ctx context.Context, tokenID string) (bool, error) {
	if s.blacklistService == nil {
		return false, nil
	}

	return s.blacklistService.IsBlacklisted(ctx, tokenID)
}

// GenerateSecureKey generates a new secure signing key
func (s *jwtService) GenerateSecureKey(keyType string) (interface{}, error) {
	switch keyType {
	case "RSA":
		// Generate 2048-bit RSA key
		key, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return nil, fmt.Errorf("failed to generate RSA key: %w", err)
		}
		return key, nil

	case "ECDSA":
		// Generate P-256 ECDSA key
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("failed to generate ECDSA key: %w", err)
		}
		return key, nil

	case "Ed25519":
		// Generate Ed25519 key
		_, key, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("failed to generate Ed25519 key: %w", err)
		}
		return key, nil

	case "HMAC":
		// Generate 256-bit HMAC key
		key := make([]byte, 32)
		_, err := rand.Read(key)
		if err != nil {
			return nil, fmt.Errorf("failed to generate HMAC key: %w", err)
		}
		return key, nil

	default:
		return nil, fmt.Errorf("unsupported key type: %s", keyType)
	}
}

// RotateKeys performs key rotation for JWT signing
func (s *jwtService) RotateKeys(ctx context.Context) error {
	// This is a simplified implementation
	// In a production system, you would want to:
	// 1. Generate a new key
	// 2. Store both old and new keys
	// 3. Use new key for signing
	// 4. Keep old key for validation until all old tokens expire

	s.logger.Info("Key rotation requested (not implemented in this version)")
	return nil
}

// GetKeyInfo returns information about the current signing key
func (s *jwtService) GetKeyInfo() KeyInfo {
	return KeyInfo{
		KeyID:     s.keyID,
		Algorithm: string(s.signingAlgorithm),
		CreatedAt: time.Now(),                           // This should be set when key is created
		ExpiresAt: time.Now().Add(365 * 24 * time.Hour), // 1 year default
	}
}

// Helper methods

func (s *jwtService) signToken(claims TokenClaims) (string, error) {
	// Create JWT builder
	builder := jwt.NewBuilder().
		JwtID(claims.TokenID).
		Issuer(claims.Issuer).
		Subject(claims.Subject).
		Audience(claims.Audience).
		IssuedAt(claims.IssuedAt).
		Expiration(claims.ExpiresAt).
		NotBefore(claims.NotBefore).
		Claim("user_id", claims.UserID).
		Claim("tenant_id", claims.TenantID).
		Claim("email", claims.Email).
		Claim("role", claims.Role).
		Claim("permissions", claims.Permissions).
		Claim("token_type", claims.TokenType).
		Claim("security_context", claims.SecurityContext)

	if claims.DeviceFingerprint != "" {
		builder = builder.Claim("device_fingerprint", claims.DeviceFingerprint)
	}

	if claims.SessionID != "" {
		builder = builder.Claim("session_id", claims.SessionID)
	}

	// Sign the token
	token, err := builder.Build()
	if err != nil {
		return "", fmt.Errorf("failed to build token: %w", err)
	}

	signed, err := jwt.Sign(token, s.signingAlgorithm, s.signingKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return string(signed), nil
}

func (s *jwtService) extractClaims(token jwt.Token) (*TokenClaims, error) {
	claims := &TokenClaims{}

	// Extract standard claims
	userID, ok := token.Get("user_id")
	if !ok {
		return nil, ErrTokenInvalid
	}
	claims.UserID, ok = userID.(string)
	if !ok {
		return nil, ErrTokenInvalid
	}

	tenantID, ok := token.Get("tenant_id")
	if !ok {
		return nil, ErrTokenInvalid
	}
	claims.TenantID, ok = tenantID.(string)
	if !ok {
		return nil, ErrTokenInvalid
	}

	email, ok := token.Get("email")
	if !ok {
		return nil, ErrTokenInvalid
	}
	claims.Email, ok = email.(string)
	if !ok {
		return nil, ErrTokenInvalid
	}

	role, ok := token.Get("role")
	if !ok {
		return nil, ErrTokenInvalid
	}
	claims.Role, ok = role.(string)
	if !ok {
		return nil, ErrTokenInvalid
	}

	permissions, ok := token.Get("permissions")
	if ok {
		if perms, ok := permissions.([]interface{}); ok {
			var permStrings []string
			for _, perm := range perms {
				if permStr, ok := perm.(string); ok {
					permStrings = append(permStrings, permStr)
				}
			}
			claims.Permissions = permStrings
		}
	}

	tokenType, ok := token.Get("token_type")
	if !ok {
		return nil, ErrTokenInvalid
	}
	claims.TokenType, ok = tokenType.(string)
	if !ok {
		return nil, ErrTokenInvalid
	}

	claims.TokenID = token.JwtID()
	claims.IssuedAt = token.IssuedAt()
	claims.ExpiresAt = token.Expiration()
	claims.NotBefore = token.NotBefore()
	claims.Issuer = token.Issuer()
	claims.Subject = token.Subject()
	claims.Audience = token.Audience()

	// Extract optional claims
	if deviceFP, ok := token.Get("device_fingerprint"); ok {
		if fpStr, ok := deviceFP.(string); ok {
			claims.DeviceFingerprint = fpStr
		}
	}

	if sessionID, ok := token.Get("session_id"); ok {
		if sidStr, ok := sessionID.(string); ok {
			claims.SessionID = sidStr
		}
	}

	if secCtx, ok := token.Get("security_context"); ok {
		if ctxMap, ok := secCtx.(map[string]interface{}); ok {
			claims.SecurityContext = make(map[string]string)
			for k, v := range ctxMap {
				if vStr, ok := v.(string); ok {
					claims.SecurityContext[k] = vStr
				}
			}
		}
	}

	return claims, nil
}

func (s *jwtService) mapJWTError(err error) error {
	if err == nil {
		return nil
	}

	switch err.Error() {
	case "exp not satisfied":
		return ErrTokenExpired
	case "nbf not satisfied":
		return ErrTokenNotValidYet
	case "failed to verify signature":
		return ErrTokenSignatureInvalid
	default:
		if _, ok := err.(jwt.InvalidTokenError); ok {
			return ErrTokenMalformed
		}
		return ErrTokenInvalid
	}
}

// Utility functions for key generation and management

// GenerateRSAKey generates a new RSA private key
func GenerateRSAKey(bits int) (*rsa.PrivateKey, error) {
	return rsa.GenerateKey(rand.Reader, bits)
}

// GenerateECDSAKey generates a new ECDSA private key
func GenerateECDSAKey() (*ecdsa.PrivateKey, error) {
	return ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
}

// GenerateHMACKey generates a new HMAC secret key
func GenerateHMACKey(size int) ([]byte, error) {
	key := make([]byte, size)
	_, err := rand.Read(key)
	return key, err
}

// ExportPrivateKey exports a private key to PEM format
func ExportPrivateKey(key interface{}) ([]byte, error) {
	switch k := key.(type) {
	case *rsa.PrivateKey:
		return pem.EncodeToMemory(&pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: x509.MarshalPKCS1PrivateKey(k),
		}), nil
	case *ecdsa.PrivateKey:
		bytes, err := x509.MarshalECPrivateKey(k)
		if err != nil {
			return nil, err
		}
		return pem.EncodeToMemory(&pem.Block{
			Type:  "EC PRIVATE KEY",
			Bytes: bytes,
		}), nil
	case []byte:
		return pem.EncodeToMemory(&pem.Block{
			Type:  "HMAC KEY",
			Bytes: k,
		}), nil
	default:
		return nil, fmt.Errorf("unsupported key type")
	}
}

// ImportPrivateKey imports a private key from PEM format
func ImportPrivateKey(pemData []byte) (interface{}, error) {
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, fmt.Errorf("failed to parse PEM block")
	}

	switch block.Type {
	case "RSA PRIVATE KEY":
		return x509.ParsePKCS1PrivateKey(block.Bytes)
	case "EC PRIVATE KEY":
		return x509.ParseECPrivateKey(block.Bytes)
	case "HMAC KEY":
		return block.Bytes, nil
	default:
		return nil, fmt.Errorf("unsupported PEM block type: %s", block.Type)
	}
}

// HashDeviceFingerprint creates a secure hash of device fingerprint
func HashDeviceFingerprint(fingerprint string) string {
	hash := sha256.Sum256([]byte(fingerprint))
	return base64.URLEncoding.EncodeToString(hash[:])
}
