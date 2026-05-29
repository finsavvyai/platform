//go:build legacy_migrated
// +build legacy_migrated

// Package cache provides session management functionality for QuantumBeam.io
package cache

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Session represents a user session in the system
type Session struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"user_id"`
	Organization string                 `json:"organization"`
	Email        string                 `json:"email"`
	Role         string                 `json:"role"`
	CreatedAt    time.Time              `json:"created_at"`
	ExpiresAt    time.Time              `json:"expires_at"`
	LastActivity time.Time              `json:"last_activity"`
	IPAddress    string                 `json:"ip_address,omitempty"`
	UserAgent    string                 `json:"user_agent,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	Active       bool                   `json:"active"`
}

// SessionManager handles session operations using Redis
type SessionManager struct {
	redisClient *RedisClient
	config      *SessionConfig
}

// SessionConfig holds session configuration
type SessionConfig struct {
	SessionDuration    time.Duration
	RefreshDuration    time.Duration
	CleanupInterval    time.Duration
	SessionPrefix      string
	UserSessionsPrefix string
	MaxSessionsPerUser int
	InactiveTimeout    time.Duration
	EnableRotation     bool
	EnableTracking     bool
	SecureCookie       bool
	SameSitePolicy     string
	CookieDomain       string
}

// NewSessionManager creates a new session manager
func NewSessionManager(redisClient *RedisClient, config *SessionConfig) *SessionManager {
	if config == nil {
		config = defaultSessionConfig()
	}

	return &SessionManager{
		redisClient: redisClient,
		config:      config,
	}
}

// defaultSessionConfig returns default session configuration
func defaultSessionConfig() *SessionConfig {
	return &SessionConfig{
		SessionDuration:    24 * time.Hour,
		RefreshDuration:    1 * time.Hour,
		CleanupInterval:    15 * time.Minute,
		SessionPrefix:      "session:",
		UserSessionsPrefix: "user_sessions:",
		MaxSessionsPerUser: 5,
		InactiveTimeout:    2 * time.Hour,
		EnableRotation:     true,
		EnableTracking:     true,
		SecureCookie:       true,
		SameSitePolicy:     "Strict",
		CookieDomain:       "",
	}
}

// CreateSession creates a new session for a user
func (sm *SessionManager) CreateSession(ctx context.Context, userID, organization, email, role, ipAddress, userAgent string) (*Session, error) {
	sessionID := sm.generateSessionID()
	now := time.Now()

	session := &Session{
		ID:           sessionID,
		UserID:       userID,
		Organization: organization,
		Email:        email,
		Role:         role,
		CreatedAt:    now,
		ExpiresAt:    now.Add(sm.config.SessionDuration),
		LastActivity: now,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		Metadata:     make(map[string]interface{}),
		Active:       true,
	}

	// Store session in Redis
	sessionKey := sm.config.SessionPrefix + sessionID
	sessionData, err := json.Marshal(session)
	if err != nil {
		log.Error().Err(err).Str("session_id", sessionID).Msg("Failed to marshal session data")
		return nil, fmt.Errorf("failed to marshal session data: %w", err)
	}

	if err := sm.redisClient.Set(ctx, sessionKey, sessionData, sm.config.SessionDuration); err != nil {
		log.Error().Err(err).Str("session_id", sessionID).Msg("Failed to store session in Redis")
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	// Add session to user's session list
	userSessionsKey := sm.config.UserSessionsPrefix + userID
	if err := sm.addUserSession(ctx, userSessionsKey, sessionID); err != nil {
		log.Error().Err(err).Str("user_id", userID).Str("session_id", sessionID).Msg("Failed to add session to user list")
		// Continue anyway - session is still valid
	}

	// Set tracking data if enabled
	if sm.config.EnableTracking {
		if err := sm.trackSessionActivity(ctx, session); err != nil {
			log.Warn().Err(err).Str("session_id", sessionID).Msg("Failed to track session activity")
		}
	}

	log.Info().
		Str("session_id", sessionID).
		Str("user_id", userID).
		Str("email", email).
		Time("expires_at", session.ExpiresAt).
		Msg("Session created successfully")

	return session, nil
}

// GetSession retrieves a session by ID
func (sm *SessionManager) GetSession(ctx context.Context, sessionID string) (*Session, error) {
	sessionKey := sm.config.SessionPrefix + sessionID

	var session Session
	if err := sm.redisClient.Get(ctx, sessionKey, &session); err != nil {
		if err == ErrKeyNotFound {
			return nil, ErrSessionNotFound
		}
		log.Error().Err(err).Str("session_id", sessionID).Msg("Failed to retrieve session from Redis")
		return nil, fmt.Errorf("failed to retrieve session: %w", err)
	}

	// Check if session is active and not expired
	if !session.Active {
		return nil, ErrSessionInactive
	}

	if time.Now().After(session.ExpiresAt) {
		// Session expired, clean it up
		sm.DeleteSession(ctx, sessionID)
		return nil, ErrSessionExpired
	}

	// Check inactive timeout
	if sm.config.InactiveTimeout > 0 && time.Since(session.LastActivity) > sm.config.InactiveTimeout {
		sm.DeleteSession(ctx, sessionID)
		return nil, ErrSessionInactive
	}

	// Update last activity
	session.LastActivity = time.Now()
	sm.updateSessionActivity(ctx, sessionKey, &session)

	return &session, nil
}

// UpdateSession updates session data
func (sm *SessionManager) UpdateSession(ctx context.Context, sessionID string, updates map[string]interface{}) error {
	session, err := sm.GetSession(ctx, sessionID)
	if err != nil {
		return err
	}

	// Apply updates
	for key, value := range updates {
		switch key {
		case "role":
			if role, ok := value.(string); ok {
				session.Role = role
			}
		case "metadata":
			if metadata, ok := value.(map[string]interface{}); ok {
				session.Metadata = metadata
			}
		case "active":
			if active, ok := value.(bool); ok {
				session.Active = active
			}
		default:
			session.Metadata[key] = value
		}
	}

	// Store updated session
	sessionKey := sm.config.SessionPrefix + sessionID
	sessionData, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("failed to marshal updated session: %w", err)
	}

	if err := sm.redisClient.Set(ctx, sessionKey, sessionData, time.Until(session.ExpiresAt)); err != nil {
		return fmt.Errorf("failed to update session: %w", err)
	}

	log.Debug().
		Str("session_id", sessionID).
		Msg("Session updated successfully")

	return nil
}

// RefreshSession extends the session expiration
func (sm *SessionManager) RefreshSession(ctx context.Context, sessionID string) (*Session, error) {
	session, err := sm.GetSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	// Extend expiration
	session.ExpiresAt = time.Now().Add(sm.config.SessionDuration)
	session.LastActivity = time.Now()

	// Update session in Redis
	sessionKey := sm.config.SessionPrefix + sessionID
	sessionData, err := json.Marshal(session)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal refreshed session: %w", err)
	}

	if err := sm.redisClient.Set(ctx, sessionKey, sessionData, sm.config.SessionDuration); err != nil {
		return nil, fmt.Errorf("failed to refresh session: %w", err)
	}

	log.Debug().
		Str("session_id", sessionID).
		Time("new_expires_at", session.ExpiresAt).
		Msg("Session refreshed successfully")

	return session, nil
}

// DeleteSession removes a session
func (sm *SessionManager) DeleteSession(ctx context.Context, sessionID string) error {
	sessionKey := sm.config.SessionPrefix + sessionID

	// Get session before deleting to clean up user session list
	session := &Session{}
	if err := sm.redisClient.Get(ctx, sessionKey, session); err == nil {
		// Remove from user's session list
		userSessionsKey := sm.config.UserSessionsPrefix + session.UserID
		sm.removeUserSession(ctx, userSessionsKey, sessionID)
	}

	// Delete session
	if err := sm.redisClient.Delete(ctx, sessionKey); err != nil {
		log.Error().Err(err).Str("session_id", sessionID).Msg("Failed to delete session from Redis")
		return fmt.Errorf("failed to delete session: %w", err)
	}

	log.Info().Str("session_id", sessionID).Msg("Session deleted successfully")
	return nil
}

// GetUserSessions returns all active sessions for a user
func (sm *SessionManager) GetUserSessions(ctx context.Context, userID string) ([]*Session, error) {
	userSessionsKey := sm.config.UserSessionsPrefix + userID

	// Get session IDs for user
	sessionIDs, err := sm.redisClient.Get(ctx, userSessionsKey, new([]string))
	if err != nil {
		if err == ErrKeyNotFound {
			return []*Session{}, nil
		}
		return nil, fmt.Errorf("failed to get user session list: %w", err)
	}

	sessionIDList := sessionIDs.(*[]string)
	var sessions []*Session

	for _, sessionID := range *sessionIDList {
		session, err := sm.GetSession(ctx, sessionID)
		if err != nil {
			// Skip invalid sessions
			continue
		}
		sessions = append(sessions, session)
	}

	return sessions, nil
}

// DeleteUserSessions removes all sessions for a user
func (sm *SessionManager) DeleteUserSessions(ctx context.Context, userID string) error {
	sessions, err := sm.GetUserSessions(ctx, userID)
	if err != nil {
		return err
	}

	for _, session := range sessions {
		if err := sm.DeleteSession(ctx, session.ID); err != nil {
			log.Error().Err(err).Str("session_id", session.ID).Msg("Failed to delete user session")
		}
	}

	// Clear user session list
	userSessionsKey := sm.config.UserSessionsPrefix + userID
	sm.redisClient.Delete(ctx, userSessionsKey)

	log.Info().Str("user_id", userID).Int("deleted_count", len(sessions)).Msg("All user sessions deleted")
	return nil
}

// CleanupExpiredSessions removes expired and inactive sessions
func (sm *SessionManager) CleanupExpiredSessions(ctx context.Context) error {
	// Get all session keys
	sessionKeys, err := sm.redisClient.Keys(ctx, sm.config.SessionPrefix+"*")
	if err != nil {
		return fmt.Errorf("failed to get session keys: %w", err)
	}

	now := time.Now()
	deletedCount := 0

	for _, key := range sessionKeys {
		var session Session
		if err := sm.redisClient.Get(ctx, key, &session); err != nil {
			// Invalid session, delete it
			sm.redisClient.Delete(ctx, key)
			deletedCount++
			continue
		}

		// Check if session should be deleted
		shouldDelete := false

		if !session.Active {
			shouldDelete = true
		} else if now.After(session.ExpiresAt) {
			shouldDelete = true
		} else if sm.config.InactiveTimeout > 0 && now.Sub(session.LastActivity) > sm.config.InactiveTimeout {
			shouldDelete = true
		}

		if shouldDelete {
			sessionID := session.ID
			sm.DeleteSession(ctx, sessionID)
			deletedCount++
		}
	}

	log.Info().
		Int("total_keys", len(sessionKeys)).
		Int("deleted_count", deletedCount).
		Msg("Session cleanup completed")

	return nil
}

// addUserSession adds a session ID to the user's session list
func (sm *SessionManager) addUserSession(ctx context.Context, userSessionsKey, sessionID string) error {
	var sessionIDs []string

	// Get existing session list
	if err := sm.redisClient.Get(ctx, userSessionsKey, &sessionIDs); err != nil && err != ErrKeyNotFound {
		return fmt.Errorf("failed to get existing user sessions: %w", err)
	}

	// Check if user has too many sessions
	if len(sessionIDs) >= sm.config.MaxSessionsPerUser {
		// Remove oldest session
		oldestSessionID := sessionIDs[0]
		sm.DeleteSession(ctx, oldestSessionID)
		sessionIDs = sessionIDs[1:]
	}

	// Add new session
	sessionIDs = append(sessionIDs, sessionID)

	// Store updated list
	return sm.redisClient.Set(ctx, userSessionsKey, sessionIDs, sm.config.SessionDuration)
}

// removeUserSession removes a session ID from the user's session list
func (sm *SessionManager) removeUserSession(ctx context.Context, userSessionsKey, sessionID string) {
	var sessionIDs []string

	if err := sm.redisClient.Get(ctx, userSessionsKey, &sessionIDs); err != nil {
		return
	}

	// Remove session ID from list
	for i, id := range sessionIDs {
		if id == sessionID {
			sessionIDs = append(sessionIDs[:i], sessionIDs[i+1:]...)
			break
		}
	}

	// Update list if not empty
	if len(sessionIDs) > 0 {
		sm.redisClient.Set(ctx, userSessionsKey, sessionIDs, sm.config.SessionDuration)
	} else {
		sm.redisClient.Delete(ctx, userSessionsKey)
	}
}

// updateSessionActivity updates the last activity timestamp
func (sm *SessionManager) updateSessionActivity(ctx context.Context, sessionKey string, session *Session) {
	sessionData, err := json.Marshal(session)
	if err != nil {
		return
	}

	// Update with short TTL to avoid extending full session duration
	sm.redisClient.Set(ctx, sessionKey, sessionData, time.Until(session.ExpiresAt))
}

// trackSessionActivity tracks session activity for analytics
func (sm *SessionManager) trackSessionActivity(ctx context.Context, session *Session) error {
	activityKey := fmt.Sprintf("session_activity:%s", session.ID)
	activity := map[string]interface{}{
		"session_id":    session.ID,
		"user_id":       session.UserID,
		"organization":  session.Organization,
		"ip_address":    session.IPAddress,
		"user_agent":    session.UserAgent,
		"created_at":    session.CreatedAt,
		"last_activity": session.LastActivity,
	}

	// Store activity data with longer retention for analytics
	return sm.redisClient.Set(ctx, activityKey, activity, 7*24*time.Hour)
}

// generateSessionID generates a secure random session ID
func (sm *SessionManager) generateSessionID() string {
	// Generate UUID-based session ID
	sessionUUID := uuid.New()

	// Add random data for additional entropy
	randomBytes := make([]byte, 16)
	rand.Read(randomBytes)

	// Combine UUID and random data
	sessionData := append(sessionUUID[:], randomBytes...)

	// Base64 encode for URL-safe session ID
	return base64.URLEncoding.EncodeToString(sessionData)
}

// Session errors
var (
	ErrSessionNotFound = fmt.Errorf("session not found")
	ErrSessionExpired  = fmt.Errorf("session has expired")
	ErrSessionInactive = fmt.Errorf("session is inactive")
	ErrSessionInvalid  = fmt.Errorf("session is invalid")
)