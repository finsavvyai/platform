package websocket

import (
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// handleConnection handles WebSocket connection for collaboration
func (cm *CollaborationManager) handleConnection(conn *CollaborationConnection, connectionID string) {
	defer func() {
		cm.LeaveSession(conn.SessionID, conn.UserID)
		conn.Conn.Close()
	}()

	conn.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.Conn.SetPongHandler(func(string) error {
		conn.LastPing = time.Now()
		conn.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var msg CollaborationMessage
		err := conn.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				cm.logger.Debug("WebSocket connection closed unexpectedly",
					zap.String("connection_id", connectionID),
					zap.Error(err))
			}
			break
		}

		msg.SessionID = conn.SessionID
		msg.UserID = conn.UserID
		msg.Timestamp = time.Now()

		cm.metrics.MessagesReceived++

		select {
		case cm.messageChan <- msg:
		default:
			cm.logger.Warn("Message channel full, dropping collaboration message")
		}
	}
}

// sendMessages sends messages to WebSocket connection
func (cm *CollaborationManager) sendMessages(conn *CollaborationConnection) {
	ticker := time.NewTicker(54 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg := <-conn.SendChan:
			conn.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.Conn.WriteJSON(msg); err != nil {
				cm.logger.Debug("Failed to send message to WebSocket",
					zap.String("user_id", conn.UserID),
					zap.Error(err))
				return
			}
			cm.metrics.MessagesSent++

		case <-ticker.C:
			conn.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// messageProcessor processes collaboration messages
func (cm *CollaborationManager) messageProcessor() {
	for {
		select {
		case <-cm.ctx.Done():
			return
		case msg := <-cm.messageChan:
			cm.processMessage(msg)
		}
	}
}

// processMessage processes a single collaboration message
func (cm *CollaborationManager) processMessage(msg CollaborationMessage) {
	switch msg.Type {
	case MessageTypeQueryUpdate:
		if query, ok := msg.Data["query"].(string); ok {
			cm.UpdateQuery(msg.SessionID, msg.UserID, query)
		}

	case MessageTypeCursorMove:
		if cursorData, ok := msg.Data["cursor"]; ok {
			if cursorBytes, err := json.Marshal(cursorData); err == nil {
				var cursor Cursor
				if err := json.Unmarshal(cursorBytes, &cursor); err == nil {
					cm.UpdateCursor(msg.SessionID, msg.UserID, cursor)
				}
			}
		}

	case MessageTypeSelectionChange:
		if selectionData, ok := msg.Data["selection"]; ok {
			if selectionBytes, err := json.Marshal(selectionData); err == nil {
				var selection Selection
				if err := json.Unmarshal(selectionBytes, &selection); err == nil {
					cm.UpdateSelection(msg.SessionID, msg.UserID, selection)
				}
			}
		}

	case MessageTypeComment:
		if commentData, ok := msg.Data["comment"]; ok {
			if commentBytes, err := json.Marshal(commentData); err == nil {
				var comment Comment
				if err := json.Unmarshal(commentBytes, &comment); err == nil {
					cm.AddComment(msg.SessionID, msg.UserID, comment.Content, comment.Position)
				}
			}
		}
	}
}

// broadcastToSession broadcasts a message to all users in a session
func (cm *CollaborationManager) broadcastToSession(sessionID string, msg CollaborationMessage, excludeUserID string) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	session, exists := cm.sessions[sessionID]
	if !exists {
		return
	}

	for userID := range session.Users {
		if userID == excludeUserID {
			continue
		}

		for _, conn := range cm.connections {
			if conn.SessionID == sessionID && conn.UserID == userID && conn.IsActive {
				select {
				case conn.SendChan <- msg:
				default:
					cm.logger.Warn("User send channel full, dropping message",
						zap.String("user_id", userID))
				}
				break
			}
		}
	}
}

