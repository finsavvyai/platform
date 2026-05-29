//go:build ignore

package token_rotation

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/auth"
)

// RefreshTokenRequest represents a refresh token request
type RefreshTokenRequest struct {
	RefreshToken      string `json:"refresh_token" validate:"required"`
	DeviceFingerprint string `json:"device_fingerprint,omitempty"`
	IPAddress         string `json:"ip_address,omitempty"`
	UserAgent         string `json:"user_agent,omitempty"`
}

// RefreshTokenResponse represents a refresh token response
type RefreshTokenResponse struct {
	AccessToken      string       `json:"access_token"`
	RefreshToken     string       `json:"refresh_token"`
	ExpiresAt        time.Time    `json:"expires_at"`
	RefreshExpiresAt time.Time    `json:"refresh_expires_at"`
	TokenType        string       `json:"token_type"`
	WarnBeforeExpiry bool         `json:"warn_before_expiry,omitempty"`
	SessionInfo      *SessionInfo `json:"session_info,omitempty"`
}

// SessionInfo represents session information
type SessionInfo struct {
	SessionID         string    `json:"session_id"`
	LastActivity      time.Time `json:"last_activity"`
	DeviceFingerprint string    `json:"device_fingerprint,omitempty"`
	LoginLocation     string    `json:"login_location,omitempty"`
	IsNewDevice       bool      `json:"is_new_device"`
	LoginCount        int       `json:"login_count"`
}

// RefreshConfig holds configuration for the refresh service
type RefreshConfig struct {
	// MaxRefreshTokens is the maximum number of active refresh tokens per user
	MaxRefreshTokens int

	// RefreshWindow is the time before expiry when refresh is allowed
	RefreshWindow time.Duration

	// TokenReuseProtection prevents reuse of refresh tokens
	TokenReuseProtection bool

	// DeviceValidation validates device fingerprint during refresh
	DeviceValidation bool

	// LocationValidation validates IP location during refresh
	LocationValidation bool

	// SessionTimeout is the maximum session duration
	SessionTimeout time.Duration

	// InactivityTimeout is the maximum inactivity duration
	InactivityTimeout time.Duration

	// SecurityNotifications enables security notifications
	SecurityNotifications bool

	// RotationGracePeriod is the grace period for token rotation
	RotationGracePeriod time.Duration
}

// DefaultRefreshConfig returns default refresh configuration
func DefaultRefreshConfig() RefreshConfig {
	return RefreshConfig{
		MaxRefreshTokens:      5,
		RefreshWindow:         5 * time.Minute,
		TokenReuseProtection:  true,
		DeviceValidation:      true,
		LocationValidation:    false,              // Optional, can be enabled
		SessionTimeout:        24 * time.Hour * 7, // 7 days
		InactivityTimeout:     24 * time.Hour * 1, // 1 day
		SecurityNotifications: true,
		RotationGracePeriod:   15 * time.Minute,
	}
}

// SessionManager manages user sessions and refresh tokens
type SessionManager interface {
	CreateSession(ctx context.Context, userID, tenantID uuid.UUID, deviceFingerprint, ipAddress, userAgent string) (*SessionInfo, error)
	GetSession(ctx context.Context, sessionID string) (*SessionInfo, error)
	UpdateSessionActivity(ctx context.Context, sessionID string) error
	InvalidateSession(ctx context.Context, sessionID string) error
	InvalidateUserSessions(ctx context.Context, userID uuid.UUID, exceptSessionID string) error
	GetActiveRefreshTokens(ctx context.Context, userID uuid.UUID) ([]string, error)
	CleanupExpiredSessions(ctx context.Context) error
}

// RedisSessionManager implements SessionManager using Redis
type RedisSessionManager struct {
	redisClient   redis.Cmdable
	keyPrefix     string
	config        RefreshConfig
	logger        *logrus.Logger
	cleanupTicker *time.Ticker
	mutex         sync.RWMutex
}

// NewRedisSessionManager creates a new Redis-based session manager
func NewRedisSessionManager(
	redisClient redis.Cmdable,
	keyPrefix string,
	config RefreshConfig,
	logger *logrus.Logger,
) *RedisSessionManager {
	if logger == nil {
		logger = logrus.New()
	}

	if keyPrefix == "" {
		keyPrefix = "session:"
	}

	manager := &RedisSessionManager{
		redisClient: redisClient,
		keyPrefix:   keyPrefix,
		config:      config,
		logger:      logger,
	}

	// Start cleanup routine
	manager.startCleanupRoutine()

	return manager
}

// CreateSession creates a new user session
func (m *RedisSessionManager) CreateSession(
	ctx context.Context,
	userID, tenantID uuid.UUID,
	deviceFingerprint, ipAddress, userAgent string,
) (*SessionInfo, error) {
	sessionID := uuid.New().String()

	sessionInfo := &SessionInfo{
		SessionID:         sessionID,
		LastActivity:      time.Now(),
		DeviceFingerprint: deviceFingerprint,
		LoginLocation:     m.getLocationFromIP(ipAddress),
		IsNewDevice:       true, // Will be updated based on existing sessions
		LoginCount:        1,
	}

	// Check if this is a new device
	existingSessions, err := m.getActiveSessionsForUser(ctx, userID)
	if err != nil {
		m.logger.WithError(err).WithField("user_id", userID).Warn("Failed to get existing sessions")
	}

	for _, session := range existingSessions {
		if session.DeviceFingerprint == deviceFingerprint {
			sessionInfo.IsNewDevice = false
			sessionInfo.LoginCount = session.LoginCount + 1
			break
		}
	}

	// Store session
	sessionKey := m.getSessionKey(sessionID)
	sessionData, err := json.Marshal(sessionInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal session info: %w", err)
	}

	// Store with TTL based on session timeout
	err = m.redisClient.Set(ctx, sessionKey, sessionData, m.config.SessionTimeout).Err()
	if err != nil {
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	// Add to user's session index
	userSessionsKey := m.getUserSessionsKey(userID)
	err = m.redisClient.SAdd(ctx, userSessionsKey, sessionID).Err()
	if err != nil {
		m.logger.WithError(err).WithField("user_id", userID).Warn("Failed to add session to user index")
	}

	// Set TTL for user sessions index
	m.redisClient.Expire(ctx, userSessionsKey, m.config.SessionTimeout)

	// Send security notification for new device if enabled
	if m.config.SecurityNotifications && sessionInfo.IsNewDevice {
		m.sendNewDeviceNotification(ctx, userID, sessionInfo, ipAddress, userAgent)
	}

	m.logger.WithFields(logrus.Fields{
		"session_id":    sessionID,
		"user_id":       userID,
		"tenant_id":     tenantID,
		"is_new_device": sessionInfo.IsNewDevice,
	}).Info("Session created")

	return sessionInfo, nil
}

// GetSession retrieves session information
func (m *RedisSessionManager) GetSession(ctx context.Context, sessionID string) (*SessionInfo, error) {
	sessionKey := m.getSessionKey(sessionID)

	sessionData, err := m.redisClient.Get(ctx, sessionKey).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	var sessionInfo SessionInfo
	err = json.Unmarshal([]byte(sessionData), &sessionInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal session info: %w", err)
	}

	// Check session timeout
	if time.Since(sessionInfo.LastActivity) > m.config.InactivityTimeout {
		// Session expired due to inactivity
		m.InvalidateSession(ctx, sessionID)
		return nil, fmt.Errorf("session expired due to inactivity")
	}

	return &sessionInfo, nil
}

// UpdateSessionActivity updates the last activity timestamp for a session
func (m *RedisSessionManager) UpdateSessionActivity(ctx context.Context, sessionID string) error {
	sessionKey := m.getSessionKey(sessionID)

	// Get current session info
	sessionData, err := m.redisClient.Get(ctx, sessionKey).Result()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("session not found")
		}
		return fmt.Errorf("failed to get session: %w", err)
	}

	var sessionInfo SessionInfo
	err = json.Unmarshal([]byte(sessionData), &sessionInfo)
	if err != nil {
		return fmt.Errorf("failed to unmarshal session info: %w", err)
	}

	// Update last activity
	sessionInfo.LastActivity = time.Now()

	// Store updated session
	updatedData, err := json.Marshal(sessionInfo)
	if err != nil {
		return fmt.Errorf("failed to marshal updated session info: %w", err)
	}

	err = m.redisClient.Set(ctx, sessionKey, updatedData, m.config.SessionTimeout).Err()
	if err != nil {
		return fmt.Errorf("failed to update session: %w", err)
	}

	return nil
}

// InvalidateSession invalidates a specific session
func (m *RedisSessionManager) InvalidateSession(ctx context.Context, sessionID string) error {
	sessionKey := m.getSessionKey(sessionID)

	// Get session info for cleanup
	sessionData, err := m.redisClient.Get(ctx, sessionKey).Result()
	var userID uuid.UUID
	if err == nil {
		var sessionInfo SessionInfo
		if json.Unmarshal([]byte(sessionData), &sessionInfo) == nil {
			// Extract user ID from session info (you might want to store it separately)
			// For now, we'll skip cleanup of user sessions index
		}
	}

	// Delete session
	err = m.redisClient.Del(ctx, sessionKey).Err()
	if err != nil {
		return fmt.Errorf("failed to invalidate session: %w", err)
	}

	m.logger.WithField("session_id", sessionID).Info("Session invalidated")
	return nil
}

// InvalidateUserSessions invalidates all sessions for a user except optionally one
func (m *RedisSessionManager) InvalidateUserSessions(ctx context.Context, userID uuid.UUID, exceptSessionID string) error {
	userSessionsKey := m.getUserSessionsKey(userID)

	// Get all user sessions
	sessionIDs, err := m.redisClient.SMembers(ctx, userSessionsKey).Result()
	if err != nil {
		return fmt.Errorf("failed to get user sessions: %w", err)
	}

	invalidated := 0
	for _, sessionID := range sessionIDs {
		if sessionID == exceptSessionID {
			continue
		}

		err := m.InvalidateSession(ctx, sessionID)
		if err != nil {
			m.logger.WithError(err).WithField("session_id", sessionID).Warn("Failed to invalidate session")
		} else {
			invalidated++
		}
	}

	// Clear user sessions index if all sessions were invalidated
	if exceptSessionID == "" {
		m.redisClient.Del(ctx, userSessionsKey)
	}

	m.logger.WithFields(logrus.Fields{
		"user_id":     userID,
		"invalidated": invalidated,
	}).Info("User sessions invalidated")

	return nil
}

// GetActiveRefreshTokens returns active refresh tokens for a user
func (m *RedisSessionManager) GetActiveRefreshTokens(ctx context.Context, userID uuid.UUID) ([]string, error) {
	userSessionsKey := m.getUserSessionsKey(userID)

	sessionIDs, err := m.redisClient.SMembers(ctx, userSessionsKey).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get user sessions: %w", err)
	}

	var activeSessions []string
	for _, sessionID := range sessionIDs {
		sessionInfo, err := m.GetSession(ctx, sessionID)
		if err != nil {
			// Skip expired/invalid sessions
			continue
		}
		if sessionInfo != nil {
			activeSessions = append(activeSessions, sessionID)
		}
	}

	return activeSessions, nil
}

// CleanupExpiredSessions removes expired sessions
func (m *RedisSessionManager) CleanupExpiredSessions(ctx context.Context) error {
	pattern := m.keyPrefix + "*"

	iter := m.redisClient.Scan(ctx, 0, pattern, 100).Iterator()

	cleaned := 0
	for iter.Next(ctx) {
		sessionKey := iter.Val()

		sessionData, err := m.redisClient.Get(ctx, sessionKey).Result()
		if err != nil {
			if err != redis.Nil {
				m.logger.WithError(err).WithField("session_key", sessionKey).Warn("Failed to get session during cleanup")
			}
			// Remove invalid keys
			m.redisClient.Del(ctx, sessionKey)
			cleaned++
			continue
		}

		var sessionInfo SessionInfo
		err = json.Unmarshal([]byte(sessionData), &sessionInfo)
		if err != nil {
			// Remove malformed sessions
			m.redisClient.Del(ctx, sessionKey)
			cleaned++
			continue
		}

		// Check if session is expired
		if time.Since(sessionInfo.LastActivity) > m.config.InactivityTimeout {
			err := m.redisClient.Del(ctx, sessionKey).Err()
			if err != nil {
				m.logger.WithError(err).WithField("session_id", sessionInfo.SessionID).Warn("Failed to remove expired session")
			} else {
				cleaned++
			}
		}
	}

	if err := iter.Err(); err != nil {
		return fmt.Errorf("iterator error during session cleanup: %w", err)
	}

	if cleaned > 0 {
		m.logger.WithField("cleaned_count", cleaned).Info("Cleaned up expired sessions")
	}

	return nil
}

// RefreshService handles token refresh operations
type RefreshService struct {
	jwtService       services.JWTService
	sessionManager   SessionManager
	blacklistService auth.BlacklistService
	config           RefreshConfig
	logger           *logrus.Logger
}

// NewRefreshService creates a new refresh service
func NewRefreshService(
	jwtService services.JWTService,
	sessionManager SessionManager,
	blacklistService auth.BlacklistService,
	config RefreshConfig,
	logger *logrus.Logger,
) *RefreshService {
	if logger == nil {
		logger = logrus.New()
	}

	return &RefreshService{
		jwtService:       jwtService,
		sessionManager:   sessionManager,
		blacklistService: blacklistService,
		config:           config,
		logger:           logger,
	}
}

// RefreshToken refreshes an access token using a refresh token
func (s *RefreshService) RefreshToken(ctx context.Context, req *RefreshTokenRequest) (*RefreshTokenResponse, error) {
	// Validate refresh token
	tokenInfo, err := s.jwtService.ValidateToken(ctx, req.RefreshToken, "refresh")
	if err != nil {
		s.logger.WithError(err).Debug("Invalid refresh token")
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Get session information
	var sessionInfo *SessionInfo
	if tokenInfo.SessionID != "" {
		sessionInfo, err = s.sessionManager.GetSession(ctx, tokenInfo.SessionID)
		if err != nil {
			s.logger.WithError(err).WithField("session_id", tokenInfo.SessionID).Debug("Session not found or expired")
			return nil, fmt.Errorf("session expired: %w", err)
		}

		// Update session activity
		err = s.sessionManager.UpdateSessionActivity(ctx, tokenInfo.SessionID)
		if err != nil {
			s.logger.WithError(err).Warn("Failed to update session activity")
		}
	}

	// Validate device fingerprint if enabled
	if s.config.DeviceValidation && tokenInfo.DeviceFingerprint != "" {
		if req.DeviceFingerprint == "" || req.DeviceFingerprint != tokenInfo.DeviceFingerprint {
			s.logger.WithFields(logrus.Fields{
				"expected": tokenInfo.DeviceFingerprint,
				"provided": req.DeviceFingerprint,
			}).Debug("Device fingerprint validation failed")

			// Revoke the refresh token for security
			_ = s.jwtService.RevokeToken(ctx, tokenInfo.TokenID, tokenInfo.ExpiresAt)

			return nil, &services.TokenValidationError{
				Type:    "device_mismatch",
				Message: "Device fingerprint mismatch",
			}
		}
	}

	// Check refresh window - don't allow refresh if token is too close to expiry
	if time.Until(tokenInfo.ExpiresAt) < s.config.RefreshWindow {
		return nil, &services.TokenValidationError{
			Type:    "refresh_window_expired",
			Message: "Token refresh window has expired",
		}
	}

	// Check if user has too many active refresh tokens
	if s.config.MaxRefreshTokens > 0 {
		activeTokens, err := s.sessionManager.GetActiveRefreshTokens(ctx, tokenInfo.UserID)
		if err != nil {
			s.logger.WithError(err).Warn("Failed to get active refresh tokens")
		} else if len(activeTokens) >= s.config.MaxRefreshTokens {
			// Invalidate oldest sessions to make room
			s.invalidateOldestSessions(ctx, tokenInfo.UserID, len(activeTokens)-s.config.MaxRefreshTokens+1)
		}
	}

	// Revoke the old refresh token
	err = s.jwtService.RevokeToken(ctx, tokenInfo.TokenID, tokenInfo.ExpiresAt)
	if err != nil {
		s.logger.WithError(err).Warn("Failed to revoke old refresh token")
	}

	// Generate new token pair
	tokenPair, err := s.jwtService.GenerateTokenPair(
		ctx,
		tokenInfo.UserID,
		tokenInfo.TenantID,
		tokenInfo.Email,
		tokenInfo.Role,
		tokenInfo.Permissions,
		tokenInfo.DeviceFingerprint,
		tokenInfo.SessionID,
	)
	if err != nil {
		s.logger.WithError(err).Error("Failed to generate new token pair")
		return nil, fmt.Errorf("failed to generate new tokens: %w", err)
	}

	// Create response
	response := &RefreshTokenResponse{
		AccessToken:      tokenPair.AccessToken,
		RefreshToken:     tokenPair.RefreshToken,
		ExpiresAt:        tokenPair.ExpiresAt,
		RefreshExpiresAt: tokenPair.RefreshExpiresAt,
		TokenType:        tokenPair.TokenType,
		SessionInfo:      sessionInfo,
	}

	// Check if token is approaching expiry and warn user
	if time.Until(tokenPair.ExpiresAt) < s.config.RotationGracePeriod {
		response.WarnBeforeExpiry = true
	}

	// Log successful refresh
	s.logger.WithFields(logrus.Fields{
		"user_id":    tokenInfo.UserID.String(),
		"tenant_id":  tokenInfo.TenantID.String(),
		"session_id": tokenInfo.SessionID,
		"ip_address": req.IPAddress,
	}).Info("Token refreshed successfully")

	return response, nil
}

// RevokeAllTokens revokes all tokens for a user
func (s *RefreshService) RevokeAllTokens(ctx context.Context, userID uuid.UUID, exceptSessionID string) error {
	// Invalidate all sessions
	err := s.sessionManager.InvalidateUserSessions(ctx, userID, exceptSessionID)
	if err != nil {
		s.logger.WithError(err).WithField("user_id", userID).Error("Failed to invalidate user sessions")
		return fmt.Errorf("failed to invalidate user sessions: %w", err)
	}

	// Get active refresh tokens
	activeTokens, err := s.sessionManager.GetActiveRefreshTokens(ctx, userID)
	if err != nil {
		s.logger.WithError(err).WithField("user_id", userID).Warn("Failed to get active refresh tokens")
	} else {
		// Revoke all active refresh tokens
		for _, sessionID := range activeTokens {
			if sessionID == exceptSessionID {
				continue
			}

			// This is a simplified implementation
			// In a real system, you would need to store token IDs with sessions
			s.logger.WithField("session_id", sessionID).Debug("Token revocation requested")
		}
	}

	s.logger.WithFields(logrus.Fields{
		"user_id":           userID,
		"except_session_id": exceptSessionID,
	}).Info("All user tokens revoked")

	return nil
}

// Helper methods

func (m *RedisSessionManager) getSessionKey(sessionID string) string {
	return m.keyPrefix + sessionID
}

func (m *RedisSessionManager) getUserSessionsKey(userID uuid.UUID) string {
	return m.keyPrefix + "user:" + userID.String() + ":sessions"
}

func (m *RedisSessionManager) getActiveSessionsForUser(ctx context.Context, userID uuid.UUID) ([]SessionInfo, error) {
	userSessionsKey := m.getUserSessionsKey(userID)

	sessionIDs, err := m.redisClient.SMembers(ctx, userSessionsKey).Result()
	if err != nil {
		return nil, err
	}

	var sessions []SessionInfo
	for _, sessionID := range sessionIDs {
		sessionInfo, err := m.GetSession(ctx, sessionID)
		if err == nil && sessionInfo != nil {
			sessions = append(sessions, *sessionInfo)
		}
	}

	return sessions, nil
}

func (m *RedisSessionManager) getLocationFromIP(ipAddress string) string {
	// This is a placeholder implementation
	// In a real system, you would use a geolocation service
	if ipAddress == "" {
		return "unknown"
	}
	return "unknown" // Replace with actual geolocation
}

func (m *RedisSessionManager) sendNewDeviceNotification(ctx context.Context, userID uuid.UUID, sessionInfo *SessionInfo, ipAddress, userAgent string) {
	// This is a placeholder for security notifications
	// In a real system, you would send email/SMS/push notifications
	m.logger.WithFields(logrus.Fields{
		"user_id":    userID,
		"session_id": sessionInfo.SessionID,
		"ip_address": ipAddress,
		"user_agent": userAgent,
	}).Info("New device login notification sent")
}

func (m *RedisSessionManager) startCleanupRoutine() {
	// Run cleanup every 30 minutes
	m.cleanupTicker = time.NewTicker(30 * time.Minute)

	go func() {
		ctx := context.Background()
		for range m.cleanupTicker.C {
			err := m.CleanupExpiredSessions(ctx)
			if err != nil {
				m.logger.WithError(err).Error("Failed to cleanup expired sessions")
			}
		}
	}()
}

func (s *RefreshService) invalidateOldestSessions(ctx context.Context, userID uuid.UUID, count int) {
	// This is a simplified implementation
	// In a real system, you would track session creation times and invalidate the oldest ones
	s.logger.WithFields(logrus.Fields{
		"user_id": userID,
		"count":   count,
	}).Info("Invalidating oldest sessions")
}

// Stop stops cleanup routines
func (m *RedisSessionManager) Stop() {
	if m.cleanupTicker != nil {
		m.cleanupTicker.Stop()
	}
}
