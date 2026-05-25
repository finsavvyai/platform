package websocket

import (
	"context"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// CollaborationMessageType represents different collaboration message types
type CollaborationMessageType string

const (
	MessageTypeQueryUpdate     CollaborationMessageType = "query_update"
	MessageTypeCursorMove      CollaborationMessageType = "cursor_move"
	MessageTypeUserJoin        CollaborationMessageType = "user_join"
	MessageTypeUserLeave       CollaborationMessageType = "user_leave"
	MessageTypeSelectionChange CollaborationMessageType = "selection_change"
	MessageTypeComment         CollaborationMessageType = "comment"
	MessageTypStatusUpdate     CollaborationMessageType = "status_update"
	MessageTypSessionCreate    CollaborationMessageType = "session_create"
	MessageTypSessionClose     CollaborationMessageType = "session_close"
)

// CollaborationMessage represents a collaboration message
type CollaborationMessage struct {
	ID        string                   `json:"id"`
	Type      CollaborationMessageType `json:"type"`
	SessionID string                   `json:"session_id"`
	UserID    string                   `json:"user_id"`
	Timestamp time.Time                `json:"timestamp"`
	Data      map[string]interface{}   `json:"data"`
}

// CollaborationSession represents a collaborative editing session
type CollaborationSession struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Query        string                 `json:"query"`
	ConnectionID string                 `json:"connection_id"`
	DatabaseType string                 `json:"database_type"`
	CreatedBy    string                 `json:"created_by"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	IsActive     bool                   `json:"is_active"`
	Users        map[string]*User       `json:"users"`
	Metadata     map[string]interface{} `json:"metadata"`
	mu           sync.RWMutex
}

// User represents a user in a collaboration session
type User struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	Avatar      string    `json:"avatar"`
	Color       string    `json:"color"`
	Cursor      Cursor    `json:"cursor"`
	Selection   Selection `json:"selection"`
	IsActive    bool      `json:"is_active"`
	JoinedAt    time.Time `json:"joined_at"`
	LastSeen    time.Time `json:"last_seen"`
	Permissions []string  `json:"permissions"`
}

// Cursor represents a user's cursor position
type Cursor struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

// Selection represents a user's text selection
type Selection struct {
	Start Cursor `json:"start"`
	End   Cursor `json:"end"`
}

// Comment represents a query comment
type Comment struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	UserName  string    `json:"user_name"`
	Content   string    `json:"content"`
	Position  Cursor    `json:"position"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Resolved  bool      `json:"resolved"`
}

// CollaborationManager manages real-time collaboration
type CollaborationManager struct {
	sessions     map[string]*CollaborationSession
	userSessions map[string]map[string]string
	connections  map[string]*CollaborationConnection
	logger       *zap.Logger
	mu           sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc
	messageChan  chan CollaborationMessage
	metrics      *CollaborationMetrics
}

// CollaborationConnection wraps a WebSocket connection for collaboration
type CollaborationConnection struct {
	Conn      *websocket.Conn
	UserID    string
	SessionID string
	UserInfo  *User
	LastPing  time.Time
	IsActive  bool
	SendChan  chan CollaborationMessage
	mu        sync.RWMutex
}

// CollaborationMetrics tracks collaboration statistics
type CollaborationMetrics struct {
	TotalSessions      int64         `json:"total_sessions"`
	ActiveSessions     int64         `json:"active_sessions"`
	TotalUsers         int64         `json:"total_users"`
	ConcurrentUsers    int64         `json:"concurrent_users"`
	MessagesSent       int64         `json:"messages_sent"`
	MessagesReceived   int64         `json:"messages_received"`
	AvgSessionDuration time.Duration `json:"avg_session_duration"`
	TotalComments      int64         `json:"total_comments"`
	ResolvedComments   int64         `json:"resolved_comments"`
	RealtimeEdits      int64         `json:"realtime_edits"`
	CursorMovements    int64         `json:"cursor_movements"`
	UserInteractions   int64         `json:"user_interactions"`
}
