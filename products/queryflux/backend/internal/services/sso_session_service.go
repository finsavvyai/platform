package services

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/sso"

	"github.com/redis/go-redis/v9"
)

// SSOSessionManager manages SSO sessions with automatic renewal
type SSOSessionManager struct {
	sessionRepo     sso.SSOSessionRepository
	redisClient     *redis.Client
	sessionTTL      time.Duration
	cleanupInterval time.Duration
}

// NewSSOSessionManager creates a new SSO session manager
func NewSSOSessionManager(
	sessionRepo sso.SSOSessionRepository,
	redisClient *redis.Client,
	sessionTTL time.Duration,
) *SSOSessionManager {
	return &SSOSessionManager{
		sessionRepo:     sessionRepo,
		redisClient:     redisClient,
		sessionTTL:      sessionTTL,
		cleanupInterval: time.Hour, // Cleanup expired sessions every hour
	}
}

// CreateSession creates a new SSO session
func (m *SSOSessionManager) CreateSession(
	ctx context.Context,
	identityID, redirectURL string,
) (*sso.SSOSession, error) {
	// Create session
	expiresAt := time.Now().Add(m.sessionTTL)
	session, err := sso.NewSSOSession(identityID, redirectURL, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Save to database
	if err := m.sessionRepo.Create(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to save session: %w", err)
	}

	// Cache in Redis for fast lookup
	if err := m.cacheSession(ctx, session); err != nil {
		// Log error but don't fail the session creation
		fmt.Printf("Warning: failed to cache session in Redis: %v\n", err)
	}

	return session, nil
}

// ValidateSession validates and returns a session
func (m *SSOSessionManager) ValidateSession(
	ctx context.Context,
	sessionID string,
) (*sso.SSOSession, error) {
	// Try to get from Redis first
	session, err := m.getSessionFromCache(ctx, sessionID)
	if err == nil {
		// Validate session
		if err := session.Validate(); err != nil {
			return nil, fmt.Errorf("invalid session: %w", err)
		}
		return session, nil
	}

	// Fall back to database
	session, err = m.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	// Validate session
	if err := session.Validate(); err != nil {
		return nil, fmt.Errorf("invalid session: %w", err)
	}

	// Cache for future lookups
	if err := m.cacheSession(ctx, session); err != nil {
		fmt.Printf("Warning: failed to cache session in Redis: %v\n", err)
	}

	return session, nil
}

// GetSessionByState retrieves a session by state (OIDC)
func (m *SSOSessionManager) GetSessionByState(
	ctx context.Context,
	state string,
) (*sso.SSOSession, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("sso:session:state:%s", state)
	cachedID, err := m.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		return m.ValidateSession(ctx, cachedID)
	}

	// Fall back to database
	session, err := m.sessionRepo.GetByState(ctx, state)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	// Validate and cache
	if err := session.Validate(); err != nil {
		return nil, fmt.Errorf("invalid session: %w", err)
	}

	// Cache state mapping
	m.redisClient.Set(ctx, cacheKey, session.ID, m.sessionTTL)
	m.cacheSession(ctx, session)

	return session, nil
}

// GetSessionByRequestID retrieves a session by request ID (SAML)
func (m *SSOSessionManager) GetSessionByRequestID(
	ctx context.Context,
	requestID string,
) (*sso.SSOSession, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("sso:session:request:%s", requestID)
	cachedID, err := m.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		return m.ValidateSession(ctx, cachedID)
	}

	// Fall back to database
	session, err := m.sessionRepo.GetByRequestID(ctx, requestID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	// Validate and cache
	if err := session.Validate(); err != nil {
		return nil, fmt.Errorf("invalid session: %w", err)
	}

	// Cache request ID mapping
	m.redisClient.Set(ctx, cacheKey, session.ID, m.sessionTTL)
	m.cacheSession(ctx, session)

	return session, nil
}

// InvalidateSession invalidates a session
func (m *SSOSessionManager) InvalidateSession(
	ctx context.Context,
	sessionID string,
) error {
	// Deactivate in database
	session, err := m.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("session not found: %w", err)
	}

	session.Deactivate()
	if err := m.sessionRepo.Update(ctx, session); err != nil {
		return fmt.Errorf("failed to update session: %w", err)
	}

	// Remove from cache
	m.removeSessionFromCache(ctx, sessionID)

	// Remove state/request ID mappings if present
	if session.State != "" {
		cacheKey := fmt.Sprintf("sso:session:state:%s", session.State)
		m.redisClient.Del(ctx, cacheKey)
	}
	if session.RequestID != "" {
		cacheKey := fmt.Sprintf("sso:session:request:%s", session.RequestID)
		m.redisClient.Del(ctx, cacheKey)
	}

	return nil
}

// InvalidateUserSessions invalidates all sessions for a user
func (m *SSOSessionManager) InvalidateUserSessions(
	ctx context.Context,
	userID string,
) error {
	// Get all active sessions for the user
	// This would require getting identities first, then sessions
	// For now, we'll use the repository method directly
	if err := m.sessionRepo.DeactivateByUser(ctx, userID); err != nil {
		return fmt.Errorf("failed to deactivate user sessions: %w", err)
	}

	// Clear user session cache
	cacheKey := fmt.Sprintf("sso:user:sessions:%s", userID)
	m.redisClient.Del(ctx, cacheKey)

	return nil
}

// CleanupExpiredSessions removes expired sessions
func (m *SSOSessionManager) CleanupExpiredSessions(ctx context.Context) error {
	// Clean up expired sessions in database
	if err := m.sessionRepo.DeleteExpired(ctx); err != nil {
		return fmt.Errorf("failed to delete expired sessions: %w", err)
	}

	// Clean up expired cache entries
	pattern := "sso:session:*"
	iter := m.redisClient.Scan(ctx, 0, pattern, 0).Iterator()

	for iter.Next(ctx) {
		key := iter.Val()
		// Check if session is expired
		sessionID := key[14:] // Remove "sso:session:" prefix
		session, err := m.sessionRepo.GetByID(ctx, sessionID)
		if err != nil || session.IsExpired() {
			m.redisClient.Del(ctx, key)
		}
	}

	return nil
}

// StartCleanupWorker starts a background worker to clean up expired sessions
func (m *SSOSessionManager) StartCleanupWorker(ctx context.Context) {
	ticker := time.NewTicker(m.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := m.CleanupExpiredSessions(ctx); err != nil {
				fmt.Printf("Error cleaning up expired sessions: %v\n", err)
			}
		}
	}
}

// RenewSession extends a session's expiration
func (m *SSOSessionManager) RenewSession(
	ctx context.Context,
	sessionID string,
) (*sso.SSOSession, error) {
	// Get current session
	session, err := m.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	// Check if session is still valid
	if !session.IsActive || session.IsExpired() {
		return nil, fmt.Errorf("session cannot be renewed")
	}

	// Extend expiration
	session.ExpiresAt = time.Now().Add(m.sessionTTL)
	session.UpdatedAt = time.Now()

	// Update in database
	if err := m.sessionRepo.Update(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to update session: %w", err)
	}

	// Update cache
	if err := m.cacheSession(ctx, session); err != nil {
		fmt.Printf("Warning: failed to cache renewed session: %v\n", err)
	}

	return session, nil
}

// GetActiveSessionsCount returns the number of active sessions
func (m *SSOSessionManager) GetActiveSessionsCount(ctx context.Context) (int64, error) {
	// Use Redis for fast counting if available
	_, err := m.redisClient.DBSize(ctx).Result()
	if err == nil {
		// Filter for SSO sessions
		iter := m.redisClient.Scan(ctx, 0, "sso:session:*", 0).Iterator()
		ssoCount := int64(0)
		for iter.Next(ctx) {
			ssoCount++
		}
		return ssoCount, nil
	}

	// Fall back to database count
	// This would require adding a CountActive method to the repository
	return 0, fmt.Errorf("not implemented")
}

// GetSessionStats returns statistics about SSO sessions
func (m *SSOSessionManager) GetSessionStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Count active sessions by provider
	providerStats := make(map[string]int64)
	pattern := "sso:session:*"
	iter := m.redisClient.Scan(ctx, 0, pattern, 0).Iterator()

	totalSessions := int64(0)
	for iter.Next(ctx) {
		sessionID := iter.Val()[14:] // Remove prefix
		session, err := m.sessionRepo.GetByID(ctx, sessionID)
		if err == nil && session.IsActive && !session.IsExpired() {
			// Get provider through identity
			identity, err := m.get_identity_by_session_id(ctx, session.ID)
			if err == nil {
				providerStats[identity.ProviderID]++
				totalSessions++
			}
		}
	}

	stats["total_active_sessions"] = totalSessions
	stats["sessions_by_provider"] = providerStats
	stats["session_ttl_minutes"] = m.sessionTTL.Minutes()

	return stats, nil
}

// Helper methods

func (m *SSOSessionManager) cacheSession(ctx context.Context, session *sso.SSOSession) error {
	cacheKey := fmt.Sprintf("sso:session:%s", session.ID)

	idID := ""
	if session.IdentityID != nil {
		idID = *session.IdentityID
	}

	// Cache session data
	sessionData := map[string]interface{}{
		"id":           session.ID,
		"identity_id":  idID,
		"redirect_url": session.RedirectURL,
		"request_id":   session.RequestID,
		"state":        session.State,
		"nonce":        session.Nonce,
		"expires_at":   session.ExpiresAt.Format(time.RFC3339),
		"is_active":    fmt.Sprintf("%v", session.IsActive),
	}

	return m.redisClient.HMSet(ctx, cacheKey, sessionData).Err()
}

func (m *SSOSessionManager) getSessionFromCache(ctx context.Context, sessionID string) (*sso.SSOSession, error) {
	cacheKey := fmt.Sprintf("sso:session:%s", sessionID)

	data, err := m.redisClient.HGetAll(ctx, cacheKey).Result()
	if err != nil || len(data) == 0 {
		return nil, fmt.Errorf("session not in cache")
	}

	// Build session from cached data
	var identityID *string
	if idStr, ok := data["identity_id"]; ok && idStr != "" {
		identityID = &idStr
	}

	isActive := data["is_active"] == "true" || data["is_active"] == "1"

	session := &sso.SSOSession{
		ID:          data["id"],
		IdentityID:  identityID,
		RedirectURL: data["redirect_url"],
		RequestID:   data["request_id"],
		State:       data["state"],
		Nonce:       data["nonce"],
		IsActive:    isActive,
	}

	// Parse expiration time
	if expiresAtStr, exists := data["expires_at"]; exists {
		if expiresAt, err := time.Parse(time.RFC3339, expiresAtStr); err == nil {
			session.ExpiresAt = expiresAt
		}
	}

	return session, nil
}

func (m *SSOSessionManager) removeSessionFromCache(ctx context.Context, sessionID string) {
	cacheKey := fmt.Sprintf("sso:session:%s", sessionID)
	m.redisClient.Del(ctx, cacheKey)
}

func (m *SSOSessionManager) get_identity_by_session_id(ctx context.Context, sessionID string) (*sso.SSOIdentity, error) {
	// This would require access to the identity repository
	// For now, return a placeholder
	return nil, fmt.Errorf("not implemented")
}
