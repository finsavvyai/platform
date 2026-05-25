package server

import (
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocket upgrader with CORS settings
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Message types for WebSocket communication
const (
	MessageTypeSubscribe     = "subscribe"
	MessageTypeUnsubscribe   = "unsubscribe"
	MessageTypeMetrics       = "metrics"
	MessageTypeQueryProgress = "query_progress"
	MessageTypeQueryResult   = "query_result"
	MessageTypeQueryCancel   = "query_cancel"
	MessageTypeCollabEdit    = "collab_edit"
	MessageTypeCollabCursor  = "collab_cursor"
	MessageTypeError         = "error"
	MessageTypeHeartbeat     = "heartbeat"
)

// Room types for organizing WebSocket connections
const (
	RoomTypeMetrics    = "metrics"
	RoomTypeQuery      = "query"
	RoomTypeCollabEdit = "collab_edit"
)

// WebSocketMessage represents a message sent over WebSocket
type WebSocketMessage struct {
	Type      string      `json:"type"`
	Room      string      `json:"room,omitempty"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
	UserID    string      `json:"user_id,omitempty"`
	RequestID string      `json:"request_id,omitempty"`
}

// RoomMessage represents a message to be sent to a specific room
type RoomMessage struct {
	Room    string
	Message []byte
	Exclude *Client // Optional client to exclude from broadcast
}

// QueryProgressData represents query execution progress
type QueryProgressData struct {
	QueryID      string  `json:"query_id"`
	Status       string  `json:"status"`
	Progress     float64 `json:"progress"`
	Message      string  `json:"message"`
	RowsAffected int     `json:"rows_affected,omitempty"`
	Duration     int64   `json:"duration_ms"`
}

// CollaborativeEditData represents collaborative editing operations
type CollaborativeEditData struct {
	DocumentID string    `json:"document_id"`
	Operation  string    `json:"operation"`
	Position   int       `json:"position"`
	Content    string    `json:"content"`
	UserID     string    `json:"user_id"`
	Timestamp  time.Time `json:"timestamp"`
}

// CursorData represents cursor position in collaborative editing
type CursorData struct {
	DocumentID string `json:"document_id"`
	UserID     string `json:"user_id"`
	Position   int    `json:"position"`
	Selection  struct {
		Start int `json:"start"`
		End   int `json:"end"`
	} `json:"selection"`
}
