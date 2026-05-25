package server

import (
	"encoding/json"
	"time"

	"github.com/sirupsen/logrus"
)

func (c *Client) sendMessage(msg *WebSocketMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		logrus.WithError(err).Error("Failed to marshal message")
		return
	}
	select {
	case c.send <- data:
	default:
		close(c.send)
	}
}

func (c *Client) sendError(errorMsg string) {
	c.sendMessage(&WebSocketMessage{
		Type:      MessageTypeError,
		Data:      map[string]string{"error": errorMsg},
		Timestamp: time.Now(),
	})
}

// SetMetadata sets metadata for the client
func (c *Client) SetMetadata(key string, value interface{}) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.metadata[key] = value
}

// GetMetadata gets metadata for the client
func (c *Client) GetMetadata(key string) (interface{}, bool) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	value, exists := c.metadata[key]
	return value, exists
}

func (c *Client) canAccessRoom(room string) bool {
	if len(room) > len(RoomTypeMetrics) && room[:len(RoomTypeMetrics)] == RoomTypeMetrics {
		return true
	}
	if len(room) > len(RoomTypeQuery) && room[:len(RoomTypeQuery)] == RoomTypeQuery {
		return true
	}
	if len(room) > len(RoomTypeCollabEdit) && room[:len(RoomTypeCollabEdit)] == RoomTypeCollabEdit {
		return true
	}
	return false
}

func (c *Client) canAccessDocument(documentID string) bool {
	return true
}

func (c *Client) applyOperationalTransformation(edit *CollaborativeEditData) *CollaborativeEditData {
	return edit
}
