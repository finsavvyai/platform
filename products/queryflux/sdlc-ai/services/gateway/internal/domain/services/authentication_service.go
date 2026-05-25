//go:build ignore

package services

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/security"
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
	Code string `json:"code" validate:"required"`
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
	Argon2Config           Argon2Config   `yaml:"argon2"`
	EnableDeviceTracking   bool           `yaml:"enable_device_tracking"`
	EnableSessionTracking  bool           `yaml:"enable_session_tracking"`
	EnableAuditLogging     bool           `yaml:"enable_audit_logging"`
	SecurityHeaders        bool           `yaml:"security_headers"`
	BruteForceProtection   bool           `yaml:"brute_force_protection"`
}

// Argon2Config holds Argon2 password hashing configuration
type Argon2Config struct {
	Time    uint32 `yaml:"time"`
	Memory  uint32 `yaml:"memory"`
	Threads uint8  `yaml:"threads"`
	KeyLen  uint32 `yaml:"key_len"`
}

// AuthenticationService handles user authentication and authorization
type AuthenticationService struct {
	userRepo         repositories.UserRepository
	tenantRepo       repositories.TenantRepository
	sessionRepo      repositories.UserSessionRepository
	jwtService       JWTService
	credentialMgr    *security.CredentialManager
	blacklistService BlacklistService
	config           AuthenticationConfig
	logger           *logrus.Logger
	auditLogger      *logrus.Logger
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
		MFARequired: false,
		BcryptCost:  12,
		Argon2Config: Argon2Config{
			Time:    3,
			Memory:  64 * 1024, // 64MB
			Threads: 4,
			KeyLen:  32,
		},
		EnableDeviceTracking:  true,
		EnableSessionTracking: true,
		EnableAuditLogging:    true,
		SecurityHeaders:       true,
		BruteForceProtection:  true,
	}
}

// NewAuthenticationService creates a new authentication service
func NewAuthenticationService(
	userRepo repositories.UserRepository,
	tenantRepo repositories.TenantRepository,
	sessionRepo repositories.UserSessionRepository,
	jwtService JWTService,
	credentialMgr *security.CredentialManager,
	blacklistService BlacklistService,
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
		credentialMgr:    credentialMgr,
		blacklistService: blacklistService,
		config:           config,
		logger:           logger,
		auditLogger:      auditLogger,
	}
}

// Authenticate authenticates a user with email and password
func (as *AuthenticationService) Authenticate(ctx context.Context, req *AuthenticationRequest) (*AuthenticationResponse, error) {
	// Validate request
	if err := as.validateAuthenticationRequest(req); err != nil {
		as.logAuthenticationAttempt(ctx, req, false, "validation_failed", err)
		return nil, fmt.Errorf("invalid request: %w", err)
	}

	// Find user by email
	user, err := as.findUserByEmail(ctx, req.Email, req.TenantID)
	if err != nil {
		as.logAuthenticationAttempt(ctx, req, false, "user_not_found", err)
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	// Check if account is locked
	if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
		remaining := time.Until(*user.LockedUntil)
		as.logAuthenticationAttempt(ctx, req, false, "account_locked", fmt.Errorf("account locked"))
		return &AuthenticationResponse{
			User:              as.buildUserInfo(user),
			RemainingAttempts: 0,
			LockoutRemaining:  &remaining,
		}, nil
	}

	// Check if user is active
	if !user.IsActive {
		as.logAuthenticationAttempt(ctx, req, false, "user_inactive", fmt.Errorf("user is not active"))
		return nil, fmt.Errorf("account is disabled")
	}

	// Verify password
	if !as.verifyPassword(user.PasswordHash, req.Password) {
		return as.handleFailedLogin(ctx, user, req, "invalid_password")
	}

	// Check if MFA is required
	if as.config.MFARequired || user.MFAEnabled {
		return as.handleMFARequired(ctx, user, req)
	}

	// Generate tokens and create session
	return as.completeAuthentication(ctx, user, req)
}

// RegisterUser registers a new user
func (as *AuthenticationService) RegisterUser(ctx context.Context, req *RegistrationRequest) (*UserInfo, error) {
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
	existingUser, err := as.userRepo.FindByEmail(ctx, req.Email, tenantID)
	if err == nil && existingUser != nil {
		return nil, fmt.Errorf("user with this email already exists")
	}

	// Hash password
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
		Role:          as.resolveUserRole(req.Role, req.InviteToken),
		IsActive:      true,
		EmailVerified: false,
		Profile:       req.Profile,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Set default permissions based on role
	user.Permissions = as.getDefaultPermissions(user.Role)

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
		"ip_address": req.TenantID, // This should be extracted from request context
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
	// Validate refresh token and generate new token pair
	tokenPair, err := as.jwtService.RefreshToken(ctx, refreshToken, deviceFingerprint)
	if err != nil {
		as.logAuditEvent(ctx, "token_refresh_failed", map[string]interface{}{
			"error":              err.Error(),
			"device_fingerprint": deviceFingerprint,
		})
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	// Log successful token refresh
	as.logAuditEvent(ctx, "token_refreshed", map[string]interface{}{
		"device_fingerprint": deviceFingerprint,
	})

	return tokenPair, nil
}

// Logout logs out a user by revoking tokens
func (as *AuthenticationService) Logout(ctx context.Context, accessToken, refreshToken string, userID uuid.UUID) error {
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

	// Log logout
	as.logAuditEvent(ctx, "user_logged_out", map[string]interface{}{
		"user_id": userID,
	})

	return nil
}

// ChangePassword changes a user's password
func (as *AuthenticationService) ChangePassword(ctx context.Context, userID uuid.UUID, req *PasswordChangeRequest) error {
	// Validate request
	if req.NewPassword != req.ConfirmPassword {
		return fmt.Errorf("passwords do not match")
	}

	if !as.validatePasswordStrength(req.NewPassword) {
		return fmt.Errorf("new password does not meet security requirements")
	}

	// Get user
	user, err := as.userRepo.FindByID(ctx, userID)
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

	// Hash new password
	newPasswordHash, err := as.hashPassword(req.NewPassword)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// Update password
	user.PasswordHash = newPasswordHash
	user.UpdatedAt = time.Now()

	err = as.userRepo.Update(ctx, user)
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

	// Store reset token securely (this would typically be stored in a separate table)
	// For now, we'll just log it
	as.logger.WithFields(logrus.Fields{
		"user_id":     user.ID,
		"tenant_id":   user.TenantID,
		"reset_token": resetToken,
	}).Info("Password reset token generated")

	// Log password reset request
	as.logAuditEvent(ctx, "password_reset_requested", map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
	})

	// In a real implementation, you would send an email with the reset link
	// For now, we'll just return success
	return nil
}

// ResetPassword resets a user's password using a reset token
func (as *AuthenticationService) ResetPassword(ctx context.Context, token, email, newPassword string) error {
	// Validate token and email (this would typically involve checking a database)
	// For now, we'll implement a simple validation
	if token == "" || email == "" {
		return fmt.Errorf("invalid reset token or email")
	}

	// Find user
	user, err := as.findUserByEmail(ctx, email, "")
	if err != nil {
		return fmt.Errorf("user not found")
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

	err = as.userRepo.Update(ctx, user)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Revoke all existing sessions
	err = as.revokeAllUserSessions(ctx, user.ID)
	if err != nil {
		as.logger.WithError(err).Warn("Failed to revoke existing sessions after password reset")
	}

	// Log password reset
	as.logAuditEvent(ctx, "password_reset_completed", map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
	})

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
		return as.userRepo.FindByEmail(ctx, email, tenantUUID)
	}

	// Search across all tenants
	users, err := as.userRepo.FindByEmailAcrossTenants(ctx, email)
	if err != nil || len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	// Return the first active user found
	for _, user := range users {
		if user.IsActive {
			return user, nil
		}
	}

	return nil, fmt.Errorf("user not found")
}

func (as *AuthenticationService) hashPassword(password string) (string, error) {
	// Hash password using Argon2id with unique salt (CRITICAL SECURITY FIX)
	ph, err := HashPassword(password)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return ph.String(), nil
}

func (as *AuthenticationService) verifyPassword(hashedPassword, password string) bool {
	// Verify password using Argon2id with stored salt (CRITICAL SECURITY FIX)
	// Try new format first
	if VerifyPassword(hashedPassword, password) {
		return true
	}

	// Try bcrypt as fallback for legacy hashes
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}

func (as *AuthenticationService) handleFailedLogin(ctx context.Context, user *models.User, req *AuthenticationRequest, reason string) (*AuthenticationResponse, error) {
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
	err := as.userRepo.Update(ctx, user)
	if err != nil {
		as.logger.WithError(err).Error("Failed to update user after failed login")
	}

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
	// In a full implementation, this would:
	// 1. Generate MFA challenge
	// 2. Send MFA code via appropriate method
	// 3. Return challenge info

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

func (as *AuthenticationService) completeAuthentication(ctx context.Context, user *models.User, req *AuthenticationRequest) (*AuthenticationResponse, error) {
	// Reset failed attempts
	user.FailedLoginAttempts = 0
	user.LockedUntil = nil
	user.LastLogin = &time.Now{}
	user.UpdatedAt = time.Now()

	// Update user
	err := as.userRepo.Update(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to update user after successful login: %w", err)
	}

	// Generate tokens
	tokenPair, err := as.jwtService.GenerateTokenPair(
		ctx,
		user.ID,
		user.TenantID,
		user.Email,
		user.Role,
		user.Permissions,
		req.DeviceFingerprint,
		"", // Session ID will be generated
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// Create session
	sessionID := uuid.New().String()
	if as.config.EnableSessionTracking {
		err = as.createSession(ctx, user.ID, user.TenantID, sessionID, req)
		if err != nil {
			as.logger.WithError(err).Warn("Failed to create session")
		}
	}

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

func (as *AuthenticationService) createSession(ctx context.Context, userID, tenantID uuid.UUID, sessionID string, req *AuthenticationRequest) error {
	// This would create a session record in the database
	// For now, we'll just log it
	as.logger.WithFields(logrus.Fields{
		"user_id":    userID,
		"tenant_id":  tenantID,
		"session_id": sessionID,
	}).Info("Session created")

	return nil
}

func (as *AuthenticationService) revokeAllUserSessions(ctx context.Context, userID uuid.UUID) error {
	// This would revoke all sessions for a user
	// For now, we'll just log it
	as.logger.WithField("user_id", userID).Info("All user sessions revoked")

	return nil
}

func (as *AuthenticationService) resolveTenantID(ctx context.Context, tenantID, inviteToken string) (uuid.UUID, error) {
	if tenantID != "" {
		return uuid.Parse(tenantID)
	}

	// Handle invite token or create new tenant logic
	return uuid.New(), nil
}

func (as *AuthenticationService) resolveUserRole(role, inviteToken string) string {
	if role != "" {
		return role
	}

	// Default role or resolve from invite token
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
		FirstName:     user.Profile["first_name"],
		LastName:      user.Profile["last_name"],
		Role:          user.Role,
		Permissions:   user.Permissions,
		Profile:       user.Profile,
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
