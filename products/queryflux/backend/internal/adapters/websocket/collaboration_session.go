package websocket

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	ws "github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// NewCollaborationManager creates a new collaboration manager
func NewCollaborationManager(logger *zap.Logger) *CollaborationManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &CollaborationManager{
		sessions:     make(map[string]*CollaborationSession),
		userSessions: make(map[string]map[string]string),
		connections:  make(map[string]*CollaborationConnection),
		logger:       logger,
		ctx:          ctx,
		cancel:       cancel,
		messageChan:  make(chan CollaborationMessage, 1000),
		metrics:      &CollaborationMetrics{},
	}
}

// Start starts the collaboration manager
func (cm *CollaborationManager) Start() error {
	cm.logger.Info("Starting collaboration manager")
	go cm.messageProcessor()
	go cm.sessionCleanup()
	return nil
}

// Stop stops the collaboration manager
func (cm *CollaborationManager) Stop() error {
	cm.cancel()
	close(cm.messageChan)

	cm.mu.Lock()
	for _, conn := range cm.connections {
		conn.Conn.Close()
	}
	cm.mu.Unlock()

	cm.logger.Info("Collaboration manager stopped")
	return nil
}

// CreateSession creates a new collaboration session
func (cm *CollaborationManager) CreateSession(name, query, connectionID, databaseType, createdBy string) (*CollaborationSession, error) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	sessionID := uuid.New().String()

	session := &CollaborationSession{
		ID:           sessionID,
		Name:         name,
		Query:        query,
		ConnectionID: connectionID,
		DatabaseType: databaseType,
		CreatedBy:    createdBy,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		IsActive:     true,
		Users:        make(map[string]*User),
		Metadata:     make(map[string]interface{}),
	}

	cm.sessions[sessionID] = session
	cm.metrics.TotalSessions++
	cm.metrics.ActiveSessions++

	cm.logger.Info("Collaboration session created",
		zap.String("session_id", sessionID), zap.String("name", name), zap.String("created_by", createdBy))

	return session, nil
}

// JoinSession adds a user to a collaboration session
func (cm *CollaborationManager) JoinSession(sessionID, userID, userName, userEmail string, conn *ws.Conn) (*CollaborationSession, error) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	session, exists := cm.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	if !session.IsActive {
		return nil, fmt.Errorf("session %s is not active", sessionID)
	}

	user := &User{
		ID:          userID,
		Name:        userName,
		Email:       userEmail,
		Color:       cm.generateUserColor(),
		Cursor:      Cursor{Line: 1, Column: 1},
		IsActive:    true,
		JoinedAt:    time.Now(),
		LastSeen:    time.Now(),
		Permissions: []string{"read", "write"},
	}

	collabConn := &CollaborationConnection{
		Conn:      conn,
		UserID:    userID,
		SessionID: sessionID,
		UserInfo:  user,
		LastPing:  time.Now(),
		IsActive:  true,
		SendChan:  make(chan CollaborationMessage, 100),
	}

	connectionID := uuid.New().String()
	cm.connections[connectionID] = collabConn

	session.Users[userID] = user
	session.UpdatedAt = time.Now()

	if cm.userSessions[userID] == nil {
		cm.userSessions[userID] = make(map[string]string)
	}
	cm.userSessions[userID][sessionID] = connectionID

	cm.metrics.ConcurrentUsers++

	joinMsg := CollaborationMessage{
		ID:        uuid.New().String(),
		Type:      MessageTypeUserJoin,
		SessionID: sessionID,
		UserID:    userID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"user": user,
		},
	}

	cm.broadcastToSession(sessionID, joinMsg, userID)

	go cm.handleConnection(collabConn, connectionID)
	go cm.sendMessages(collabConn)

	cm.logger.Info("User joined collaboration session",
		zap.String("session_id", sessionID), zap.String("user_id", userID), zap.String("user_name", userName))

	return session, nil
}

// LeaveSession removes a user from a collaboration session
func (cm *CollaborationManager) LeaveSession(sessionID, userID string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	session, exists := cm.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session %s not found", sessionID)
	}

	if user, userExists := session.Users[userID]; userExists {
		delete(session.Users, userID)
		session.UpdatedAt = time.Now()
		cm.metrics.ConcurrentUsers--

		leaveMsg := CollaborationMessage{
			ID:        uuid.New().String(),
			Type:      MessageTypeUserLeave,
			SessionID: sessionID,
			UserID:    userID,
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"user_id":   userID,
				"user_name": user.Name,
			},
		}

		cm.broadcastToSession(sessionID, leaveMsg, "")
	}

	if userSessions, ok := cm.userSessions[userID]; ok {
		delete(userSessions, sessionID)
		if len(userSessions) == 0 {
			delete(cm.userSessions, userID)
		}
	}
	for connID, conn := range cm.connections {
		if conn.SessionID == sessionID && conn.UserID == userID {
			conn.Conn.Close()
			delete(cm.connections, connID)
			break
		}
	}
	cm.logger.Info("User left collaboration session",
		zap.String("session_id", sessionID), zap.String("user_id", userID))
	return nil
}
