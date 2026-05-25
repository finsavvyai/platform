package websocket

import (
	"time"

	"go.uber.org/zap"
)

// sessionCleanup performs cleanup of inactive sessions and users
func (cm *CollaborationManager) sessionCleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-cm.ctx.Done():
			return
		case <-ticker.C:
			cm.cleanupInactiveSessions()
			cm.cleanupInactiveUsers()
		}
	}
}

// cleanupInactiveSessions removes inactive sessions
func (cm *CollaborationManager) cleanupInactiveSessions() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	now := time.Now()
	for sessionID, session := range cm.sessions {
		if len(session.Users) == 0 && now.Sub(session.UpdatedAt) > time.Hour {
			session.IsActive = false
			cm.metrics.ActiveSessions--

			cm.logger.Info("Session closed due to inactivity",
				zap.String("session_id", sessionID))
		}
	}
}

// cleanupInactiveUsers removes inactive users
func (cm *CollaborationManager) cleanupInactiveUsers() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	now := time.Now()
	for sessionID, session := range cm.sessions {
		for userID, user := range session.Users {
			if now.Sub(user.LastSeen) > 30*time.Minute {
				delete(session.Users, userID)
				session.UpdatedAt = now
				cm.metrics.ConcurrentUsers--

				cm.logger.Info("User removed due to inactivity",
					zap.String("session_id", sessionID),
					zap.String("user_id", userID))
			}
		}
	}
}
