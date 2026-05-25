package websocket

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// UpdateQuery updates the query in a collaboration session
func (cm *CollaborationManager) UpdateQuery(sessionID, userID, query string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	session, exists := cm.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session %s not found", sessionID)
	}

	user, userExists := session.Users[userID]
	if !userExists || !cm.hasPermission(user, "write") {
		return fmt.Errorf("user %s does not have write permission", userID)
	}

	session.Query = query
	session.UpdatedAt = time.Now()

	updateMsg := CollaborationMessage{
		ID:        uuid.New().String(),
		Type:      MessageTypeQueryUpdate,
		SessionID: sessionID,
		UserID:    userID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"query": query,
		},
	}

	cm.broadcastToSession(sessionID, updateMsg, "")
	cm.metrics.RealtimeEdits++

	cm.logger.Debug("Query updated in collaboration session",
		zap.String("session_id", sessionID),
		zap.String("user_id", userID))

	return nil
}

// UpdateCursor updates a user's cursor position
func (cm *CollaborationManager) UpdateCursor(sessionID, userID string, cursor Cursor) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	session, exists := cm.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session %s not found", sessionID)
	}

	user, userExists := session.Users[userID]
	if !userExists {
		return fmt.Errorf("user %s not in session", userID)
	}

	user.Cursor = cursor
	user.LastSeen = time.Now()

	cursorMsg := CollaborationMessage{
		ID:        uuid.New().String(),
		Type:      MessageTypeCursorMove,
		SessionID: sessionID,
		UserID:    userID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"cursor": cursor,
		},
	}

	cm.broadcastToSession(sessionID, cursorMsg, userID)
	cm.metrics.CursorMovements++

	return nil
}

// UpdateSelection updates a user's text selection
func (cm *CollaborationManager) UpdateSelection(sessionID, userID string, selection Selection) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	session, exists := cm.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session %s not found", sessionID)
	}

	user, userExists := session.Users[userID]
	if !userExists {
		return fmt.Errorf("user %s not in session", userID)
	}

	user.Selection = selection
	user.LastSeen = time.Now()

	selectionMsg := CollaborationMessage{
		ID:        uuid.New().String(),
		Type:      MessageTypeSelectionChange,
		SessionID: sessionID,
		UserID:    userID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"selection": selection,
		},
	}

	cm.broadcastToSession(sessionID, selectionMsg, userID)
	cm.metrics.UserInteractions++

	return nil
}

// AddComment adds a comment to the query
func (cm *CollaborationManager) AddComment(sessionID, userID, content string, position Cursor) (*Comment, error) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	session, exists := cm.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	user, userExists := session.Users[userID]
	if !userExists {
		return nil, fmt.Errorf("user %s not in session", userID)
	}

	comment := &Comment{
		ID:        uuid.New().String(),
		UserID:    userID,
		UserName:  user.Name,
		Content:   content,
		Position:  position,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Resolved:  false,
	}

	if session.Metadata["comments"] == nil {
		session.Metadata["comments"] = make([]*Comment, 0)
	}
	comments := session.Metadata["comments"].([]*Comment)
	session.Metadata["comments"] = append(comments, comment)

	commentMsg := CollaborationMessage{
		ID:        uuid.New().String(),
		Type:      MessageTypeComment,
		SessionID: sessionID,
		UserID:    userID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"comment": comment,
		},
	}

	cm.broadcastToSession(sessionID, commentMsg, "")
	cm.metrics.TotalComments++

	cm.logger.Info("Comment added to collaboration session",
		zap.String("session_id", sessionID),
		zap.String("user_id", userID),
		zap.String("comment_id", comment.ID))

	return comment, nil
}

// hasPermission checks if a user has a specific permission
func (cm *CollaborationManager) hasPermission(user *User, permission string) bool {
	for _, p := range user.Permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// generateUserColor generates a color for a user
func (cm *CollaborationManager) generateUserColor() string {
	colors := []string{
		"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
		"#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2",
	}

	return colors[len(cm.connections)%len(colors)]
}
