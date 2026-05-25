package websocket

import "fmt"

// GetSession returns a collaboration session
func (cm *CollaborationManager) GetSession(sessionID string) (*CollaborationSession, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	session, exists := cm.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	sessionCopy := &CollaborationSession{
		ID:           session.ID,
		Name:         session.Name,
		Query:        session.Query,
		ConnectionID: session.ConnectionID,
		DatabaseType: session.DatabaseType,
		CreatedBy:    session.CreatedBy,
		CreatedAt:    session.CreatedAt,
		UpdatedAt:    session.UpdatedAt,
		IsActive:     session.IsActive,
		Users:        make(map[string]*User),
		Metadata:     make(map[string]interface{}),
	}

	for userID, user := range session.Users {
		userCopy := *user
		sessionCopy.Users[userID] = &userCopy
	}

	return sessionCopy, nil
}

// GetMetrics returns collaboration metrics
func (cm *CollaborationManager) GetMetrics() CollaborationMetrics {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return *cm.metrics
}

// GetActiveSessions returns all active sessions
func (cm *CollaborationManager) GetActiveSessions() []*CollaborationSession {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	sessions := make([]*CollaborationSession, 0)
	for _, session := range cm.sessions {
		if session.IsActive {
			sessions = append(sessions, session)
		}
	}

	return sessions
}
