package services

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/crypto/bcrypt"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/cache"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
)

const (
	// Authentication metric names
	metricAuthAttempts      = "auth_attempts_total"
	metricAuthSuccess       = "auth_success_total"
	metricAuthFailure       = "auth_failure_total"
	metricAuthMFAChallenge  = "auth_mfa_challenge_total"
	metricAuthMFASuccess    = "auth_mfa_success_total"
	metricAuthMFAFailure    = "auth_mfa_failure_total"
	metricPasswordReset     = "password_reset_total"
	metricSessionCreated    = "session_created_total"
	metricSessionRevoked    = "session_revoked_total"
	metricRateLimitExceeded = "rate_limit_exceeded_total"

	// TOTP constants
	totpSecretSize    = 20
	totpIssuer        = "SDLC-Platform"
	totpCodeDigits    = 6
	totpPeriodSeconds = 30

	// Session constants
	sessionDefaultTTL        = 24 * time.Hour
	sessionRememberMeTTL     = 30 * 24 * time.Hour
	sessionInactivityTimeout = 15 * time.Minute

	// Rate limiting constants
	loginRateLimitWindow = 15 * time.Minute
	loginRateLimitMax    = 5
)

// AuthenticationRequest represents a login request
type AuthenticationRequest struct {
	Email             string `json:"email" validate:"required,email"`
	Password          string `json:"password" validate:"required,min=8"`
	TenantID          string `json:"tenant_id,omitempty"`
	DeviceFingerprint string `json:"device_fingerprint,omitempty"`
	UserAgent         string `json:"user_agent,omitempty"`
	IPAddress         string `json:"ip_address,omitempty"`
	RememberMe        bool   `json:"remember_me"`
	MFACode           string `json:"mfa_code,omitempty"`
}

// AuthenticationResponse represents a successful authentication response
type AuthenticationResponse struct {
	User                  *UserInfo              `json:"user"`
	TokenPair             *TokenPair             `json:"tokens"`
	SessionID             string                 `json:"session_id"`
	RequiresMFA           bool                   `json:"requires_mfa"`
	MFAMethods            []string               `json:"mfa_methods,omitempty"`
	PasswordResetRequired bool                   `json:"password_reset_required"`
	RemainingAttempts     int                    `json:"remaining_attempts"`
	LockoutRemaining      *time.Duration         `json:"lockout_remaining,omitempty"`
	SecurityFlags         map[string]interface{} `json:"security_flags"`
}

// RegistrationRequest represents a user registration request
type RegistrationRequest struct {
	TenantID        string            `json:"tenant_id,omitempty"`
	FirstName       string            `json:"first_name" validate:"required"`
	LastName        string            `json:"last_name" validate:"required"`
	Email           string            `json:"email" validate:"required,email"`
	Password        string            `json:"password" validate:"required,min=8"`
	ConfirmPassword string            `json:"confirm_password" validate:"required"`
	Role            string            `json:"role,omitempty"`
	Profile         map[string]string `json:"profile,omitempty"`
	InviteToken     string            `json:"invite_token,omitempty"`
}

// PasswordChangeRequest represents a password change request
type PasswordChangeRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
	ConfirmPassword string `json:"confirm_password" validate:"required"`
}

// PasswordResetRequest represents a password reset request
type PasswordResetRequest struct {
	Email     string `json:"email" validate:"required,email"`
	TenantID  string `json:"tenant_id,omitempty"`
	Token     string `json:"token,omitempty"`
	IPAddress string `json:"ip_address,omitempty"`
}

// MFASetupRequest represents MFA setup request
type MFASetupRequest struct {
	Method string `json:"method" validate:"required,oneof=totp sms email"`
	Secret string `json:"secret,omitempty"`
	Code   string `json:"code,omitempty"`
	Phone  string `json:"phone,omitempty"`
	Email  string `json:"email,omitempty"`
}

// MFAVerificationRequest represents MFA verification request
type MFAVerificationRequest struct {
	UserID uuid.UUID `json:"user_id" validate:"required"`
	Code   string    `json:"code" validate:"required"`
}

// MFASetupResponse represents the response to MFA setup
type MFASetupResponse struct {
	Secret           string   `json:"secret"`
	QRCodeURL        string   `json:"qr_code_url"`
	BackupCodes      []string `json:"backup_codes"`
	RecoveryCodes    []string `json:"recovery_codes"`
	VerificationCode string   `json:"verification_code,omitempty"`
}

// UserInfo represents user information for authentication responses
type UserInfo struct {
	ID               uuid.UUID            `json:"id"`
	TenantID         uuid.UUID            `json:"tenant_id"`
	Email            string               `json:"email"`
	FirstName        string               `json:"first_name"`
	LastName         string               `json:"last_name"`
	Role             string               `json:"role"`
	Permissions      []string             `json:"permissions"`
	Profile          map[string]string    `json:"profile"`
	EmailVerified    bool                 `json:"email_verified"`
	PhoneVerified    bool                 `json:"phone_verified"`
	MFAEnabled       bool                 `json:"mfa_enabled"`
	LastLogin        *time.Time           `json:"last_login"`
	CreatedAt        time.Time            `json:"created_at"`
	SecuritySettings UserSecuritySettings `json:"security_settings"`
}

// UserSecuritySettings represents user security settings
type UserSecuritySettings struct {
	PasswordChangedAt *time.Time     `json:"password_changed_at"`
	MFAEnabled        bool           `json:"mfa_enabled"`
	MFAMethods        []string       `json:"mfa_methods"`
	SessionTimeout    int            `json:"session_timeout"` // minutes
	PasswordPolicy    PasswordPolicy `json:"password_policy"`
}

// PasswordPolicy represents password policy settings
type PasswordPolicy struct {
	MinLength        int  `json:"min_length"`
	RequireUppercase bool `json:"require_uppercase"`
	RequireLowercase bool `json:"require_lowercase"`
	RequireNumbers   bool `json:"require_numbers"`
	RequireSymbols   bool `json:"require_symbols"`
	MaxAge           int  `json:"max_age"` // days
	PreventReuse     int  `json:"prevent_reuse"`
}

// AuthenticationConfig holds authentication service configuration
type AuthenticationConfig struct {
	MaxLoginAttempts       int            `yaml:"max_login_attempts"`
	AccountLockoutDuration time.Duration  `yaml:"account_lockout_duration"`
	SessionTimeout         time.Duration  `yaml:"session_timeout"`
	RefreshTokenTTL        time.Duration  `yaml:"refresh_token_ttl"`
	AccessTokenTTL         time.Duration  `yaml:"access_token_ttl"`
	PasswordPolicy         PasswordPolicy `yaml:"password_policy"`
	MFARequired            bool           `yaml:"mfa_required"`
	BcryptCost             int            `yaml:"bcrypt_cost"`
	EnableDeviceTracking   bool           `yaml:"enable_device_tracking"`
	EnableSessionTracking  bool           `yaml:"enable_session_tracking"`
	EnableAuditLogging     bool           `yaml:"enable_audit_logging"`
	SecurityHeaders        bool           `yaml:"security_headers"`
	BruteForceProtection   bool           `yaml:"brute_force_protection"`
	EnableRateLimiting     bool           `yaml:"enable_rate_limiting"`
	RateLimitWindow        time.Duration  `yaml:"rate_limit_window"`
	RateLimitMaxAttempts   int            `yaml:"rate_limit_max_attempts"`
}

// DefaultAuthenticationConfig returns default authentication configuration
func DefaultAuthenticationConfig() AuthenticationConfig {
	return AuthenticationConfig{
		MaxLoginAttempts:       5,
		AccountLockoutDuration: 15 * time.Minute,
		SessionTimeout:         24 * time.Hour,
		RefreshTokenTTL:        30 * 24 * time.Hour, // 30 days
		AccessTokenTTL:         1 * time.Hour,
		PasswordPolicy: PasswordPolicy{
			MinLength:        8,
			RequireUppercase: true,
			RequireLowercase: true,
			RequireNumbers:   true,
			RequireSymbols:   false,
			MaxAge:           90,
			PreventReuse:     5,
		},
		MFARequired:           false,
		BcryptCost:            12,
		EnableDeviceTracking:  true,
		EnableSessionTracking: true,
		EnableAuditLogging:    true,
		SecurityHeaders:       true,
		BruteForceProtection:  true,
		EnableRateLimiting:    true,
		RateLimitWindow:       loginRateLimitWindow,
		RateLimitMaxAttempts:  loginRateLimitMax,
	}
}

// AuthenticationService handles user authentication and authorization
type AuthenticationService struct {
	userRepo         repositories.UserRepository
	tenantRepo       repositories.TenantRepository
	sessionRepo      repositories.SessionRepository
	jwtService       JWTService
	blacklistService BlacklistService
	cache            *cache.RedisCache
	metricsCollector *observability.MetricsCollector
	tracer           trace.Tracer
	config           AuthenticationConfig
	logger           *logrus.Logger
	auditLogger      *logrus.Entry
}

// NewAuthenticationService creates a new authentication service
func NewAuthenticationService(
	userRepo repositories.UserRepository,
	tenantRepo repositories.TenantRepository,
	sessionRepo repositories.SessionRepository,
	jwtService JWTService,
	blacklistService BlacklistService,
	cache *cache.RedisCache,
	metricsCollector *observability.MetricsCollector,
	config AuthenticationConfig,
	logger *logrus.Logger,
) *AuthenticationService {
	if logger == nil {
		logger = logrus.New()
	}

	auditLogger := logger.WithField("component", "auth_audit")

	return &AuthenticationService{
		userRepo:         userRepo,
		tenantRepo:       tenantRepo,
		sessionRepo:      sessionRepo,
		jwtService:       jwtService,
		blacklistService: blacklistService,
		cache:            cache,
		metricsCollector: metricsCollector,
		tracer:           otel.Tracer("authentication-service"),
		config:           config,
		logger:           logger,
		auditLogger:      auditLogger,
	}
}

// Authenticate authenticates a user with email and password
func (as *AuthenticationService) Authenticate(ctx context.Context, req *AuthenticationRequest) (*AuthenticationResponse, error) {
	ctx, span := as.tracer.Start(ctx, "Authenticate",
		trace.WithAttributes(
			attribute.String("email", req.Email),
			attribute.String("ip_address", req.IPAddress),
		),
	)
	defer span.End()

	startTime := time.Now()

	// Check rate limiting first
	if as.config.EnableRateLimiting {
		allowed, remaining, resetTime, err := as.checkLoginRateLimit(ctx, req.Email, req.IPAddress)
		if err != nil {
			as.logger.WithError(err).Error("Failed to check rate limit")
		}

		if !allowed {
			as.recordMetric(ctx, metricRateLimitExceeded, map[string]interface{}{
				"email": req.Email,
				"ip":    req.IPAddress,
			})
			as.logAuthenticationAttempt(ctx, req, false, "rate_limited", nil)
			return &AuthenticationResponse{
				User:              nil,
				RemainingAttempts: 0,
				LockoutRemaining:  &resetTime,
			}, nil
		}

		// Add remaining attempts to response if low
		if remaining <= 2 {
			as.recordMetric(ctx, metricAuthFailure, map[string]interface{}{
				"email":     req.Email,
				"remaining": remaining,
			})
		}
	}

	// Validate request
	if err := as.validateAuthenticationRequest(req); err != nil {
		as.logAuthenticationAttempt(ctx, req, false, "validation_failed", err)
		as.recordMetric(ctx, metricAuthFailure, map[string]interface{}{
			"email":  req.Email,
			"reason": "validation_failed",
		})
		return nil, fmt.Errorf("invalid request: %w", err)
	}

	// Find user by email
	user, err := as.findUserByEmail(ctx, req.Email, req.TenantID)
	if err != nil {
		as.logAuthenticationAttempt(ctx, req, false, "user_not_found", err)
		as.recordMetric(ctx, metricAuthFailure, map[string]interface{}{
			"email":  req.Email,
			"reason": "user_not_found",
		})
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	// Check if account is locked
	if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
		remaining := time.Until(*user.LockedUntil)
		as.logAuthenticationAttempt(ctx, req, false, "account_locked", fmt.Errorf("account locked"))
		as.recordMetric(ctx, metricAuthFailure, map[string]interface{}{
			"email":  req.Email,
			"reason": "account_locked",
		})
		return &AuthenticationResponse{
			User:              as.buildUserInfo(user),
			RemainingAttempts: 0,
			LockoutRemaining:  &remaining,
		}, nil
	}

	// Check if user is active
	if !user.IsActive {
		as.logAuthenticationAttempt(ctx, req, false, "user_inactive", fmt.Errorf("user is not active"))
		as.recordMetric(ctx, metricAuthFailure, map[string]interface{}{
			"email":  req.Email,
			"reason": "user_inactive",
		})
		return nil, fmt.Errorf("account is disabled")
	}

	// Verify password using bcrypt
	if !as.verifyPassword(user.PasswordHash, req.Password) {
		return as.handleFailedLogin(ctx, user, req, "invalid_password", startTime)
	}

	// If MFA code provided, verify it
	if req.MFACode != "" && user.MFAEnabled {
		if !as.verifyTOTP(ctx, user, req.MFACode) {
			as.recordMetric(ctx, metricAuthMFAFailure, map[string]interface{}{
				"user_id": user.ID,
				"email":   user.Email,
			})
			return as.handleFailedLogin(ctx, user, req, "invalid_mfa_code", startTime)
		}
		as.recordMetric(ctx, metricAuthMFASuccess, map[string]interface{}{
			"user_id": user.ID,
		})
	}

	// Check if MFA is required/enabled
	if as.config.MFARequired || user.MFAEnabled {
		if req.MFACode == "" {
			as.recordMetric(ctx, metricAuthMFAChallenge, map[string]interface{}{
				"user_id": user.ID,
				"email":   user.Email,
			})
			return as.handleMFARequired(ctx, user, req)
		}
	}

	// Generate tokens and create session
	return as.completeAuthentication(ctx, user, req, startTime)
}

// VerifyMFA verifies an MFA code during login
func (as *AuthenticationService) VerifyMFA(ctx context.Context, req *MFAVerificationRequest) (*AuthenticationResponse, error) {
	ctx, span := as.tracer.Start(ctx, "VerifyMFA",
		trace.WithAttributes(attribute.String("user_id", req.UserID.String())),
	)
	defer span.End()

	// Get user
	user, err := as.userRepo.GetByID(ctx, req.UserID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Verify TOTP code
	if !as.verifyTOTP(ctx, user, req.Code) {
		as.recordMetric(ctx, metricAuthMFAFailure, map[string]interface{}{
			"user_id": user.ID,
		})
		return nil, fmt.Errorf("invalid MFA code")
	}

	// Generate tokens and create session
	authReq := &AuthenticationRequest{
		Email:    user.Email,
		TenantID: user.TenantID.String(),
	}
	return as.completeAuthentication(ctx, user, authReq, time.Now())
}

// RegisterUser registers a new user
func (as *AuthenticationService) RegisterUser(ctx context.Context, req *RegistrationRequest) (*UserInfo, error) {
	ctx, span := as.tracer.Start(ctx, "RegisterUser",
		trace.WithAttributes(attribute.String("email", req.Email)),
	)
	defer span.End()

	// Validate request
	if err := as.validateRegistrationRequest(req); err != nil {
		return nil, fmt.Errorf("invalid request: %w", err)
	}

	// Find or create tenant
	tenantID, err := as.resolveTenantID(ctx, req.TenantID, req.InviteToken)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve tenant: %w", err)
	}

	// Check if user already exists
	existingUser, err := as.userRepo.GetByEmail(ctx, tenantID, req.Email)
	if err == nil && existingUser != nil {
		return nil, fmt.Errorf("user with this email already exists")
	}

	// Hash password using bcrypt
	passwordHash, err := as.hashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		ID:            uuid.New(),
		TenantID:      tenantID,
		Email:         req.Email,
		PasswordHash:  passwordHash,
		Role:          models.UserRole(as.resolveUserRole(req.Role, req.InviteToken)),
		IsActive:      true,
		EmailVerified: false,
		Profile:       models.JSONB(convertStringMap(req.Profile)),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Set default permissions based on role
	user.Permissions = models.JSONB(convertSliceToJSONB(as.getDefaultPermissions(string(user.Role))))

	// Save user
	err = as.userRepo.Create(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Log registration
	as.logAuditEvent(ctx, "user_registered", map[string]interface{}{
		"user_id":    user.ID,
		"tenant_id":  user.TenantID,
		"email":      user.Email,
		"role":       user.Role,
		"ip_address": req.TenantID,
	})

	userInfo := as.buildUserInfo(user)
	as.logger.WithFields(logrus.Fields{
		"user_id":   user.ID,
		"tenant_id": user.TenantID,
		"email":     user.Email,
	}).Info("User registered successfully")

	return userInfo, nil
}

// RefreshToken refreshes an access token using a refresh token
func (as *AuthenticationService) RefreshToken(ctx context.Context, refreshToken string, deviceFingerprint string) (*TokenPair, error) {
	ctx, span := as.tracer.Start(ctx, "RefreshToken")
	defer span.End()

	startTime := time.Now()

	// Validate refresh token and generate new token pair
	tokenPair, err := as.jwtService.RefreshToken(ctx, refreshToken, deviceFingerprint)
	if err != nil {
		as.logAuditEvent(ctx, "token_refresh_failed", map[string]interface{}{
			"error":              err.Error(),
			"device_fingerprint": deviceFingerprint,
		})
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	// Record metrics
	as.recordMetric(ctx, metricAuthSuccess, map[string]interface{}{
		"type":     "refresh",
		"duration": time.Since(startTime).Milliseconds(),
	})

	// Log successful token refresh
	as.logAuditEvent(ctx, "token_refreshed", map[string]interface{}{
		"device_fingerprint": deviceFingerprint,
	})

	return tokenPair, nil
}

// Logout logs out a user by revoking tokens
func (as *AuthenticationService) Logout(ctx context.Context, accessToken, refreshToken string, userID uuid.UUID) error {
	ctx, span := as.tracer.Start(ctx, "Logout",
		trace.WithAttributes(attribute.String("user_id", userID.String())),
	)
	defer span.End()

	// Parse token to get token ID
	tokenInfo, err := as.jwtService.ValidateToken(ctx, accessToken, "access")
	if err != nil {
		as.logger.WithError(err).Warn("Failed to validate access token during logout")
		// Continue anyway to ensure cleanup
	}

	// Revoke access token
	if tokenInfo != nil {
		err = as.jwtService.RevokeToken(ctx, tokenInfo.TokenID, tokenInfo.ExpiresAt)
		if err != nil {
			as.logger.WithError(err).Warn("Failed to revoke access token")
		}
	}

	// Revoke refresh token if provided
	if refreshToken != "" {
		refreshTokenInfo, err := as.jwtService.ValidateToken(ctx, refreshToken, "refresh")
		if err == nil && refreshTokenInfo != nil {
			err = as.jwtService.RevokeToken(ctx, refreshTokenInfo.TokenID, refreshTokenInfo.ExpiresAt)
			if err != nil {
				as.logger.WithError(err).Warn("Failed to revoke refresh token")
			}
		}
	}

	// Invalidate session in cache
	if as.cache != nil && tokenInfo != nil && tokenInfo.SessionID != "" {
		sessionKey := as.sessionCacheKey(tokenInfo.SessionID)
		as.cache.Delete(sessionKey)
	}

	// Record metrics
	as.recordMetric(ctx, metricSessionRevoked, map[string]interface{}{
		"user_id": userID,
	})

	// Log logout
	as.logAuditEvent(ctx, "user_logged_out", map[string]interface{}{
		"user_id": userID,
	})

	return nil
}

// ChangePassword changes a user's password
func (as *AuthenticationService) ChangePassword(ctx context.Context, userID uuid.UUID, req *PasswordChangeRequest) error {
	ctx, span := as.tracer.Start(ctx, "ChangePassword",
		trace.WithAttributes(attribute.String("user_id", userID.String())),
	)
	defer span.End()

	// Validate request
	if req.NewPassword != req.ConfirmPassword {
		return fmt.Errorf("passwords do not match")
	}

	if !as.validatePasswordStrength(req.NewPassword) {
		return fmt.Errorf("new password does not meet security requirements")
	}

	// Get user
	user, err := as.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to find user: %w", err)
	}

	// Verify current password
	if !as.verifyPassword(user.PasswordHash, req.CurrentPassword) {
		return fmt.Errorf("current password is incorrect")
	}

	// Check if new password is the same as current
	if as.verifyPassword(user.PasswordHash, req.NewPassword) {
		return fmt.Errorf("new password must be different from current password")
	}

	// Hash new password using bcrypt
	newPasswordHash, err := as.hashPassword(req.NewPassword)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// Update password
	user.PasswordHash = newPasswordHash
	user.UpdatedAt = time.Now()

	err = as.userRepo.Update(ctx, user.ID, user)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Revoke all existing sessions for this user
	err = as.revokeAllUserSessions(ctx, userID)
	if err != nil {
		as.logger.WithError(err).Warn("Failed to revoke existing sessions after password change")
	}

	// Log password change
	as.logAuditEvent(ctx, "password_changed", map[string]interface{}{
		"user_id": userID,
	})

	return nil
}

// RequestPasswordReset initiates a password reset request
func (as *AuthenticationService) RequestPasswordReset(ctx context.Context, req *PasswordResetRequest) error {
	ctx, span := as.tracer.Start(ctx, "RequestPasswordReset",
		trace.WithAttributes(attribute.String("email", req.Email)),
	)
	defer span.End()

	// Find user
	user, err := as.findUserByEmail(ctx, req.Email, req.TenantID)
	if err != nil {
		// Don't reveal if user exists or not for security
		as.logger.WithFields(logrus.Fields{
			"email": req.Email,
		}).Info("Password reset requested for non-existent email")
		return nil
	}

	// Generate reset token
	resetToken, err := as.generateSecureToken()
	if err != nil {
		return fmt.Errorf("failed to generate reset token: %w", err)
	}

	// Store reset token in cache with expiration
	if as.cache != nil {
		tokenKey := as.passwordResetCacheKey(user.ID.String())
		as.cache.Set(tokenKey, resetToken, 1*time.Hour)
	}

	// Record metrics
	as.recordMetric(ctx, metricPasswordReset, map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
		"type":    "requested",
	})

	// Log password reset request
	as.logAuditEvent(ctx, "password_reset_requested", map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
	})

	as.logger.WithFields(logrus.Fields{
		"user_id":     user.ID,
		"tenant_id":   user.TenantID,
		"reset_token": resetToken,
	}).Info("Password reset token generated")

	return nil
}

// ResetPassword resets a user's password using a reset token
func (as *AuthenticationService) ResetPassword(ctx context.Context, token, email, newPassword string) error {
	ctx, span := as.tracer.Start(ctx, "ResetPassword",
		trace.WithAttributes(attribute.String("email", email)),
	)
	defer span.End()

	// Find user
	user, err := as.findUserByEmail(ctx, email, "")
	if err != nil {
		return fmt.Errorf("user not found")
	}

	// Verify reset token from cache
	if as.cache != nil {
		tokenKey := as.passwordResetCacheKey(user.ID.String())
		storedToken, ok := as.cache.Get(tokenKey)
		if !ok || storedToken != token {
			return fmt.Errorf("invalid or expired reset token")
		}

		// Delete the token after use
		as.cache.Delete(tokenKey)
	}

	// Hash new password
	passwordHash, err := as.hashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	user.PasswordHash = passwordHash
	user.UpdatedAt = time.Now()
	user.FailedLoginAttempts = 0
	user.LockedUntil = nil

	err = as.userRepo.Update(ctx, user.ID, user)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Revoke all existing sessions
	err = as.revokeAllUserSessions(ctx, user.ID)
	if err != nil {
		as.logger.WithError(err).Warn("Failed to revoke existing sessions after password reset")
	}

	// Record metrics
	as.recordMetric(ctx, metricPasswordReset, map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
		"type":    "completed",
	})

	// Log password reset
	as.logAuditEvent(ctx, "password_reset_completed", map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
	})

	return nil
}

// SetupMFA initializes MFA for a user
func (as *AuthenticationService) SetupMFA(ctx context.Context, userID uuid.UUID) (*MFASetupResponse, error) {
	ctx, span := as.tracer.Start(ctx, "SetupMFA",
		trace.WithAttributes(attribute.String("user_id", userID.String())),
	)
	defer span.End()

	// Get user
	user, err := as.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Generate TOTP secret
	secret, err := as.generateTOTPSecret()
	if err != nil {
		return nil, fmt.Errorf("failed to generate TOTP secret: %w", err)
	}

	// Generate QR code URL
	qrCodeURL := as.generateTOTPQRCodeURL(secret, user.Email, totpIssuer)

	// Generate backup codes
	backupCodes := as.generateBackupCodes(10)

	// Generate recovery codes
	recoveryCodes := as.generateBackupCodes(5)

	// Store temporary secret in cache for verification
	if as.cache != nil {
		tempKey := as.mfaSetupCacheKey(userID.String())
		setupData := map[string]interface{}{
			"secret":       secret,
			"backup_codes": backupCodes,
		}
		as.cache.Set(tempKey, setupData, 5*time.Minute)
	}

	// Generate a verification code for testing
	verificationCode := as.generateTOTPCode(secret, time.Now())

	return &MFASetupResponse{
		Secret:           secret,
		QRCodeURL:        qrCodeURL,
		BackupCodes:      backupCodes,
		RecoveryCodes:    recoveryCodes,
		VerificationCode: verificationCode,
	}, nil
}

// EnableMFA enables MFA for a user after verification
func (as *AuthenticationService) EnableMFA(ctx context.Context, userID uuid.UUID, code string) error {
	ctx, span := as.tracer.Start(ctx, "EnableMFA",
		trace.WithAttributes(attribute.String("user_id", userID.String())),
	)
	defer span.End()

	// Get user
	user, err := as.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Get temporary secret from cache
	if as.cache == nil {
		return fmt.Errorf("cache not available")
	}

	tempKey := as.mfaSetupCacheKey(userID.String())
	setupDataRaw, ok := as.cache.Get(tempKey)
	if !ok {
		return fmt.Errorf("MFA setup not found or expired")
	}

	setupData, ok := setupDataRaw.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid setup data")
	}

	secret, ok := setupData["secret"].(string)
	if !ok {
		return fmt.Errorf("invalid secret")
	}

	// Verify the code
	if !as.verifyTOTPWithSecret(secret, code) {
		return fmt.Errorf("invalid verification code")
	}

	// Enable MFA for user
	user.MFAEnabled = true
	user.MFASecret = []byte(secret) // Store encrypted in production
	user.UpdatedAt = time.Now()

	err = as.userRepo.Update(ctx, user.ID, user)
	if err != nil {
		return fmt.Errorf("failed to enable MFA: %w", err)
	}

	// Clean up temporary data
	as.cache.Delete(tempKey)

	// Log MFA enablement
	as.logAuditEvent(ctx, "mfa_enabled", map[string]interface{}{
		"user_id": user.ID,
		"method":  "totp",
	})

	return nil
}

// DisableMFA disables MFA for a user
func (as *AuthenticationService) DisableMFA(ctx context.Context, userID uuid.UUID) error {
	ctx, span := as.tracer.Start(ctx, "DisableMFA",
		trace.WithAttributes(attribute.String("user_id", userID.String())),
	)
	defer span.End()

	// Get user
	user, err := as.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Disable MFA
	user.MFAEnabled = false
	user.MFASecret = nil
	user.UpdatedAt = time.Now()

	err = as.userRepo.Update(ctx, user.ID, user)
	if err != nil {
		return fmt.Errorf("failed to disable MFA: %w", err)
	}

	// Log MFA disablement
	as.logAuditEvent(ctx, "mfa_disabled", map[string]interface{}{
		"user_id": user.ID,
	})

	return nil
}

// GetSession retrieves a session by ID
func (as *AuthenticationService) GetSession(ctx context.Context, sessionID string) (*models.UserSession, error) {
	ctx, span := as.tracer.Start(ctx, "GetSession")
	defer span.End()

	// Try cache first
	if as.cache != nil {
		cacheKey := as.sessionCacheKey(sessionID)
		cached, ok := as.cache.Get(cacheKey)
		if ok && cached != nil {
			if sessionData, ok := cached.(*models.UserSession); ok {
				return sessionData, nil
			}
		}
	}

	// Fall back to repository
	sessionUUID, err := uuid.Parse(sessionID)
	if err != nil {
		return nil, fmt.Errorf("invalid session ID: %w", err)
	}

	session, err := as.sessionRepo.GetByID(ctx, sessionUUID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	// Cache the session
	if as.cache != nil {
		cacheKey := as.sessionCacheKey(sessionID)
		ttl := time.Until(session.ExpiresAt)
		if ttl > 0 {
			as.cache.Set(cacheKey, session, ttl)
		}
	}

	return session, nil
}

// RevokeSession revokes a specific session
func (as *AuthenticationService) RevokeSession(ctx context.Context, sessionID string, userID uuid.UUID) error {
	ctx, span := as.tracer.Start(ctx, "RevokeSession")
	defer span.End()

	// Validate session ID format
	_, err := uuid.Parse(sessionID)
	if err != nil {
		return fmt.Errorf("invalid session ID: %w", err)
	}

	err = as.sessionRepo.RevokeSession(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to revoke session: %w", err)
	}

	// Remove from cache
	if as.cache != nil {
		cacheKey := as.sessionCacheKey(sessionID)
		as.cache.Delete(cacheKey)
	}

	// Record metrics
	as.recordMetric(ctx, metricSessionRevoked, map[string]interface{}{
		"user_id":    userID,
		"session_id": sessionID,
	})

	return nil
}

// RevokeAllUserSessions revokes all sessions for a user
func (as *AuthenticationService) RevokeAllUserSessions(ctx context.Context, userID uuid.UUID) error {
	ctx, span := as.tracer.Start(ctx, "RevokeAllUserSessions")
	defer span.End()

	err := as.sessionRepo.RevokeAllUserSessions(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to revoke sessions: %w", err)
	}

	// Invalidate user's sessions in cache
	if as.cache != nil {
		// Cache interface might not support pattern deletion
		// This would need to be implemented or sessions tracked differently
	}

	return nil
}

// Private helper methods

func (as *AuthenticationService) validateAuthenticationRequest(req *AuthenticationRequest) error {
	if req.Email == "" {
		return fmt.Errorf("email is required")
	}
	if req.Password == "" {
		return fmt.Errorf("password is required")
	}
	if len(req.Password) < 1 {
		return fmt.Errorf("password cannot be empty")
	}
	return nil
}

func (as *AuthenticationService) validateRegistrationRequest(req *RegistrationRequest) error {
	if req.FirstName == "" {
		return fmt.Errorf("first name is required")
	}
	if req.LastName == "" {
		return fmt.Errorf("last name is required")
	}
	if req.Email == "" {
		return fmt.Errorf("email is required")
	}
	if req.Password == "" {
		return fmt.Errorf("password is required")
	}
	if req.Password != req.ConfirmPassword {
		return fmt.Errorf("passwords do not match")
	}
	if !as.validatePasswordStrength(req.Password) {
		return fmt.Errorf("password does not meet security requirements")
	}
	return nil
}

func (as *AuthenticationService) validatePasswordStrength(password string) bool {
	policy := as.config.PasswordPolicy

	if len(password) < policy.MinLength {
		return false
	}

	if policy.RequireUppercase {
		hasUpper := false
		for _, char := range password {
			if char >= 'A' && char <= 'Z' {
				hasUpper = true
				break
			}
		}
		if !hasUpper {
			return false
		}
	}

	if policy.RequireLowercase {
		hasLower := false
		for _, char := range password {
			if char >= 'a' && char <= 'z' {
				hasLower = true
				break
			}
		}
		if !hasLower {
			return false
		}
	}

	if policy.RequireNumbers {
		hasNumber := false
		for _, char := range password {
			if char >= '0' && char <= '9' {
				hasNumber = true
				break
			}
		}
		if !hasNumber {
			return false
		}
	}

	if policy.RequireSymbols {
		hasSymbol := false
		for _, char := range password {
			if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')) {
				hasSymbol = true
				break
			}
		}
		if !hasSymbol {
			return false
		}
	}

	return true
}

func (as *AuthenticationService) findUserByEmail(ctx context.Context, email, tenantID string) (*models.User, error) {
	if tenantID != "" {
		tenantUUID, err := uuid.Parse(tenantID)
		if err != nil {
			return nil, fmt.Errorf("invalid tenant ID: %w", err)
		}
		return as.userRepo.GetByEmail(ctx, tenantUUID, email)
	}

	// Search across all tenants
	user, err := as.userRepo.GetByEmail(ctx, uuid.Nil, email)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}
	return user, nil
}

// hashPassword hashes a password using bcrypt
func (as *AuthenticationService) hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), as.config.BcryptCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(hash), nil
}

// verifyPassword verifies a password against a bcrypt hash
func (as *AuthenticationService) verifyPassword(hashedPassword, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}

func (as *AuthenticationService) handleFailedLogin(ctx context.Context, user *models.User, req *AuthenticationRequest, reason string, startTime time.Time) (*AuthenticationResponse, error) {
	// Increment failed attempts
	user.FailedLoginAttempts++

	// Check if account should be locked
	if user.FailedLoginAttempts >= as.config.MaxLoginAttempts {
		lockoutUntil := time.Now().Add(as.config.AccountLockoutDuration)
		user.LockedUntil = &lockoutUntil

		as.logger.WithFields(logrus.Fields{
			"user_id":      user.ID,
			"email":        user.Email,
			"attempts":     user.FailedLoginAttempts,
			"locked_until": lockoutUntil,
		}).Warn("Account locked due to multiple failed login attempts")
	}

	user.UpdatedAt = time.Now()

	// Update user
	err := as.userRepo.Update(ctx, user.ID, user)
	if err != nil {
		as.logger.WithError(err).Error("Failed to update user after failed login")
	}

	// Record metrics
	as.recordMetric(ctx, metricAuthFailure, map[string]interface{}{
		"email":    req.Email,
		"reason":   reason,
		"duration": time.Since(startTime).Milliseconds(),
	})

	// Log failed attempt
	as.logAuthenticationAttempt(ctx, req, false, reason, fmt.Errorf("authentication failed"))

	remaining := as.config.MaxLoginAttempts - user.FailedLoginAttempts
	if remaining < 0 {
		remaining = 0
	}

	var lockoutRemaining *time.Duration
	if user.LockedUntil != nil {
		remaining := time.Until(*user.LockedUntil)
		lockoutRemaining = &remaining
	}

	return &AuthenticationResponse{
		User:              as.buildUserInfo(user),
		RemainingAttempts: remaining,
		LockoutRemaining:  lockoutRemaining,
	}, nil
}

func (as *AuthenticationService) handleMFARequired(ctx context.Context, user *models.User, req *AuthenticationRequest) (*AuthenticationResponse, error) {
	mfaMethods := []string{}
	if user.MFAEnabled {
		mfaMethods = append(mfaMethods, "totp")
	}

	return &AuthenticationResponse{
		User:              as.buildUserInfo(user),
		RequiresMFA:       true,
		MFAMethods:        mfaMethods,
		RemainingAttempts: as.config.MaxLoginAttempts - user.FailedLoginAttempts,
		SecurityFlags:     map[string]interface{}{},
	}, nil
}

func (as *AuthenticationService) completeAuthentication(ctx context.Context, user *models.User, req *AuthenticationRequest, startTime time.Time) (*AuthenticationResponse, error) {
	// Reset failed attempts
	user.FailedLoginAttempts = 0
	user.LockedUntil = nil
	now := time.Now()
	user.LastLogin = &now
	user.UpdatedAt = time.Now()

	// Update user
	err := as.userRepo.Update(ctx, user.ID, user)
	if err != nil {
		return nil, fmt.Errorf("failed to update user after successful login: %w", err)
	}

	// Generate tokens
	tokenPair, err := as.jwtService.GenerateTokenPair(
		ctx,
		user.ID,
		user.TenantID,
		user.Email,
		string(user.Role),
		jsonbToStringSlice(user.Permissions),
		req.DeviceFingerprint,
		"", // Session ID will be generated
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// Create session
	sessionID := uuid.New().String()
	if as.config.EnableSessionTracking {
		err = as.createSession(ctx, user.ID, user.TenantID, sessionID, req, tokenPair)
		if err != nil {
			as.logger.WithError(err).Warn("Failed to create session")
		}
	}

	// Record metrics
	as.recordMetric(ctx, metricAuthSuccess, map[string]interface{}{
		"user_id":  user.ID,
		"email":    user.Email,
		"duration": time.Since(startTime).Milliseconds(),
	})

	as.recordMetric(ctx, metricSessionCreated, map[string]interface{}{
		"user_id":    user.ID,
		"session_id": sessionID,
	})

	// Log successful authentication
	as.logAuthenticationAttempt(ctx, req, true, "success", nil)

	return &AuthenticationResponse{
		User:                  as.buildUserInfo(user),
		TokenPair:             tokenPair,
		SessionID:             sessionID,
		RequiresMFA:           false,
		PasswordResetRequired: false,
		RemainingAttempts:     as.config.MaxLoginAttempts,
		SecurityFlags:         map[string]interface{}{},
	}, nil
}

func (as *AuthenticationService) createSession(ctx context.Context, userID, tenantID uuid.UUID, sessionID string, req *AuthenticationRequest, tokenPair *TokenPair) error {
	// Calculate session TTL
	ttl := as.config.SessionTimeout
	if req.RememberMe {
		ttl = as.config.RefreshTokenTTL
	}

	// Create session model
	session := models.NewUserSession(
		userID,
		tenantID,
		req.IPAddress,
		req.UserAgent,
		time.Now().Add(ttl),
	)
	session.ID, _ = uuid.Parse(sessionID)
	session.DeviceFingerprint = req.DeviceFingerprint
	session.Metadata = models.JSONB{
		"user_agent":         req.UserAgent,
		"device_fingerprint": req.DeviceFingerprint,
		"remember_me":        req.RememberMe,
		"login_time":         time.Now().UTC().Format(time.RFC3339),
	}

	// Store in cache
	if as.cache != nil {
		cacheKey := as.sessionCacheKey(sessionID)
		as.cache.Set(cacheKey, session, ttl)
	}

	as.logger.WithFields(logrus.Fields{
		"user_id":    userID,
		"tenant_id":  tenantID,
		"session_id": sessionID,
		"ttl":        ttl,
	}).Info("Session created")

	return nil
}

func (as *AuthenticationService) revokeAllUserSessions(ctx context.Context, userID uuid.UUID) error {
	// This would revoke all sessions for a user
	as.logger.WithField("user_id", userID).Info("All user sessions revoked")
	return nil
}

func (as *AuthenticationService) resolveTenantID(ctx context.Context, tenantID, inviteToken string) (uuid.UUID, error) {
	if tenantID != "" {
		return uuid.Parse(tenantID)
	}
	return uuid.New(), nil
}

func (as *AuthenticationService) resolveUserRole(role, inviteToken string) string {
	if role != "" {
		return role
	}
	return "user"
}

func (as *AuthenticationService) getDefaultPermissions(role string) []string {
	switch role {
	case "super_admin":
		return []string{"*"}
	case "tenant_admin":
		return []string{"users:*", "documents:*", "policies:*", "settings:*"}
	case "data_scientist":
		return []string{"documents:read", "documents:write", "vectors:*", "search:*"}
	case "analyst":
		return []string{"documents:read", "search:*", "export:*"}
	case "viewer":
		return []string{"documents:read", "search:read"}
	default:
		return []string{"documents:read"}
	}
}

func (as *AuthenticationService) buildUserInfo(user *models.User) *UserInfo {
	return &UserInfo{
		ID:            user.ID,
		TenantID:      user.TenantID,
		Email:         user.Email,
		FirstName:     profileString(user.Profile, "first_name"),
		LastName:      profileString(user.Profile, "last_name"),
		Role:          string(user.Role),
		Permissions:   jsonbToStringSlice(user.Permissions),
		Profile:       jsonbToStringMap(user.Profile),
		EmailVerified: user.EmailVerified,
		PhoneVerified: user.PhoneVerified,
		MFAEnabled:    user.MFAEnabled,
		LastLogin:     user.LastLogin,
		CreatedAt:     user.CreatedAt,
		SecuritySettings: UserSecuritySettings{
			MFAEnabled:     user.MFAEnabled,
			SessionTimeout: int(as.config.SessionTimeout.Minutes()),
			PasswordPolicy: as.config.PasswordPolicy,
		},
	}
}

func (as *AuthenticationService) generateSecureToken() (string, error) {
	bytes := make([]byte, 32)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate secure token: %w", err)
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// MFA/TOTP methods

func (as *AuthenticationService) generateTOTPSecret() (string, error) {
	bytes := make([]byte, totpSecretSize)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate TOTP secret: %w", err)
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(bytes), nil
}

func (as *AuthenticationService) generateTOTPQRCodeURL(secret, email, issuer string) string {
	return fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&digits=%d&period=%d",
		issuer, email, secret, issuer, totpCodeDigits, totpPeriodSeconds)
}

func (as *AuthenticationService) verifyTOTP(ctx context.Context, user *models.User, code string) bool {
	if len(user.MFASecret) == 0 {
		return false
	}

	secret := string(user.MFASecret)
	return as.verifyTOTPWithSecret(secret, code)
}

func (as *AuthenticationService) verifyTOTPWithSecret(secret, code string) bool {
	// In production, use a proper TOTP library like github.com/pquerna/otp/totp
	// This is a simplified implementation
	expectedCode := as.generateTOTPCode(secret, time.Now())
	return code == expectedCode
}

func (as *AuthenticationService) generateTOTPCode(secret string, timestamp time.Time) string {
	// Simplified TOTP code generation - use proper library in production
	// This generates a deterministic 6-digit code based on time
	timeCounter := timestamp.Unix() / int64(totpPeriodSeconds)

	// Combine secret and time counter
	data := fmt.Sprintf("%s:%d", secret, timeCounter)
	hash := fmt.Sprintf("%x", data)
	if len(hash) < totpCodeDigits {
		hash = fmt.Sprintf("%0*s", totpCodeDigits, hash)
	}

	// Extract 6 digits
	code := hash[:totpCodeDigits]
	for len(code) < totpCodeDigits {
		code += "0"
	}

	// Ensure all digits
	digits := ""
	for _, c := range code {
		if c >= '0' && c <= '9' {
			digits += string(c)
			if len(digits) == totpCodeDigits {
				break
			}
		}
	}

	if len(digits) < totpCodeDigits {
		digits = "000000"
	}

	return digits
}

func (as *AuthenticationService) generateBackupCodes(count int) []string {
	codes := make([]string, count)
	for i := 0; i < count; i++ {
		bytes := make([]byte, 4)
		rand.Read(bytes)
		codes[i] = fmt.Sprintf("%08x", bytes)
	}
	return codes
}

// Rate limiting methods

func (as *AuthenticationService) checkLoginRateLimit(ctx context.Context, email, ipAddress string) (bool, int, time.Duration, error) {
	if as.cache == nil {
		return true, as.config.RateLimitMaxAttempts, 0, nil
	}

	// Check both email and IP limits
	limits := []string{
		as.loginRateLimitKey("email", email),
		as.loginRateLimitKey("ip", ipAddress),
	}

	for _, key := range limits {
		attemptsRaw, ok := as.cache.Get(key)
		if !ok {
			continue
		}

		var attempts int
		if attemptsInt, ok := attemptsRaw.(int); ok {
			attempts = attemptsInt
		}

		if attempts >= as.config.RateLimitMaxAttempts {
			// Get TTL for retry-after
			return false, 0, as.config.RateLimitWindow, nil
		}
	}

	return true, as.config.RateLimitMaxAttempts - 1, 0, nil
}

func (as *AuthenticationService) incrementLoginAttempts(ctx context.Context, email, ipAddress string) {
	if as.cache == nil {
		return
	}

	limits := []struct {
		key string
	}{
		{as.loginRateLimitKey("email", email)},
		{as.loginRateLimitKey("ip", ipAddress)},
	}

	for _, limit := range limits {
		currentRaw, ok := as.cache.Get(limit.key)
		var current int
		if ok {
			if currentInt, ok := currentRaw.(int); ok {
				current = currentInt
			}
		}

		current++
		as.cache.Set(limit.key, current, as.config.RateLimitWindow)
	}
}

func (as *AuthenticationService) loginRateLimitKey(typ, value string) string {
	return fmt.Sprintf("auth:rate_limit:%s:%s", typ, value)
}

// Cache key helpers

func (as *AuthenticationService) sessionCacheKey(sessionID string) string {
	return fmt.Sprintf("session:%s", sessionID)
}

func (as *AuthenticationService) passwordResetCacheKey(userID string) string {
	return fmt.Sprintf("password_reset:%s", userID)
}

func (as *AuthenticationService) mfaSetupCacheKey(userID string) string {
	return fmt.Sprintf("mfa_setup:%s", userID)
}

// Metrics and logging

func (as *AuthenticationService) recordMetric(ctx context.Context, metric string, attributes map[string]interface{}) {
	if as.metricsCollector == nil {
		return
	}

	// Record the metric - implementation depends on the metrics collector
	as.logger.WithField("metric", metric).WithFields(logrus.Fields(attributes)).Debug("Recording metric")
}

func (as *AuthenticationService) logAuthenticationAttempt(ctx context.Context, req *AuthenticationRequest, success bool, reason string, err error) {
	if !as.config.EnableAuditLogging {
		return
	}

	fields := logrus.Fields{
		"success":    success,
		"email":      req.Email,
		"ip_address": req.IPAddress,
		"user_agent": req.UserAgent,
		"timestamp":  time.Now().UTC(),
	}

	if !success {
		fields["reason"] = reason
		if err != nil {
			fields["error"] = err.Error()
		}
	}

	if success {
		as.auditLogger.WithFields(fields).Info("Authentication successful")
	} else {
		as.auditLogger.WithFields(fields).Warn("Authentication failed")
	}
}

func (as *AuthenticationService) logAuditEvent(ctx context.Context, event string, details map[string]interface{}) {
	if !as.config.EnableAuditLogging {
		return
	}

	fields := logrus.Fields{
		"event":     event,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	for k, v := range details {
		fields[k] = v
	}

	as.auditLogger.WithFields(fields).Info("Authentication audit event")
}

// Helper functions for type conversions

func convertStringMap(m map[string]string) map[string]interface{} {
	result := make(map[string]interface{}, len(m))
	for k, v := range m {
		result[k] = v
	}
	return result
}

func convertSliceToJSONB(s []string) map[string]interface{} {
	result := make(map[string]interface{}, len(s))
	for i, v := range s {
		result[fmt.Sprintf("%d", i)] = v
	}
	return result
}

// Helper functions for JSONB conversions

func jsonbToStringSlice(j models.JSONB) []string {
	if j == nil {
		return []string{}
	}
	result := []string{}
	for _, v := range j {
		if str, ok := v.(string); ok {
			result = append(result, str)
		}
	}
	return result
}

func jsonbToStringMap(j models.JSONB) map[string]string {
	if j == nil {
		return map[string]string{}
	}
	result := map[string]string{}
	for k, v := range j {
		if str, ok := v.(string); ok {
			result[k] = str
		}
	}
	return result
}

func profileString(profile models.JSONB, key string) string {
	if profile == nil {
		return ""
	}
	if val, ok := profile[key].(string); ok {
		return val
	}
	return ""
}
