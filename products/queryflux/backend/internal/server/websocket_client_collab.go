package server

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

// handleCollaborativeEdit handles collaborative editing operations
func (c *Client) handleCollaborativeEdit(msg *WebSocketMessage) {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.sendError("Invalid collaborative edit data")
		return
	}

	editData := &CollaborativeEditData{
		UserID:    c.userID,
		Timestamp: time.Now(),
	}

	if documentID, ok := data["document_id"].(string); ok {
		editData.DocumentID = documentID
	} else {
		c.sendError("Document ID is required for collaborative editing")
		return
	}

	if operation, ok := data["operation"].(string); ok {
		editData.Operation = operation
	} else {
		c.sendError("Operation is required for collaborative editing")
		return
	}

	if position, ok := data["position"].(float64); ok {
		editData.Position = int(position)
	}
	if content, ok := data["content"].(string); ok {
		editData.Content = content
	}

	if !c.canAccessDocument(editData.DocumentID) {
		c.sendError("Access denied to document: " + editData.DocumentID)
		return
	}

	transformedEdit := c.applyOperationalTransformation(editData)
	c.hub.BroadcastCollaborativeEdit(editData.DocumentID, transformedEdit, c)
}

// handleCursorUpdate handles cursor position updates in collaborative editing
func (c *Client) handleCursorUpdate(msg *WebSocketMessage) {
	data, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.sendError("Invalid cursor data")
		return
	}

	cursorData := &CursorData{UserID: c.userID}

	if documentID, ok := data["document_id"].(string); ok {
		cursorData.DocumentID = documentID
	} else {
		c.sendError("Document ID is required for cursor update")
		return
	}

	if position, ok := data["position"].(float64); ok {
		cursorData.Position = int(position)
	}
	if selection, ok := data["selection"].(map[string]interface{}); ok {
		if start, ok := selection["start"].(float64); ok {
			cursorData.Selection.Start = int(start)
		}
		if end, ok := selection["end"].(float64); ok {
			cursorData.Selection.End = int(end)
		}
	}

	if !c.canAccessDocument(cursorData.DocumentID) {
		return
	}

	room := fmt.Sprintf("%s_%s", RoomTypeCollabEdit, cursorData.DocumentID)
	message := WebSocketMessage{
		Type: MessageTypeCollabCursor, Room: room,
		Data: cursorData, Timestamp: time.Now(), UserID: c.userID,
	}

	if msgData, err := json.Marshal(message); err == nil {
		c.hub.roomBroadcast <- RoomMessage{
			Room: room, Message: msgData, Exclude: c,
		}
	} else {
		logrus.WithError(err).Error("Failed to marshal cursor update")
	}
}
