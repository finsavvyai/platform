package ai

import (
	"encoding/json"
	"fmt"
	"time"
)

// Role identifies who authored a message.
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

// Message is a single turn in the conversation.
type Message struct {
	Role      Role            `json:"role"`
	Content   string          `json:"content"`
	ToolCalls []ToolCall       `json:"tool_calls,omitempty"`
	ToolID    string          `json:"tool_call_id,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
}

// ToolCall represents a tool invocation request.
type ToolCall struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Args     json.RawMessage `json:"arguments"`
}

// Session holds the full conversation state for a screening workflow.
type Session struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	EntityName  string    `json:"entity_name"`
	Messages    []Message `json:"messages"`
	TokensUsed  int       `json:"tokens_used"`
	CreatedAt   time.Time `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

// NewSession starts a screening conversation.
func NewSession(tenantID, entityName string) *Session {
	return &Session{
		ID:         fmt.Sprintf("sess_%d", time.Now().UnixNano()),
		TenantID:   tenantID,
		EntityName: entityName,
		CreatedAt:  time.Now().UTC(),
	}
}

// AddMessage appends a message to the session.
func (s *Session) AddMessage(role Role, content string) {
	s.Messages = append(s.Messages, Message{
		Role:      role,
		Content:   content,
		Timestamp: time.Now().UTC(),
	})
}

// AddToolResult records a tool execution result.
func (s *Session) AddToolResult(toolID, content string) {
	s.Messages = append(s.Messages, Message{
		Role:      RoleTool,
		Content:   content,
		ToolID:    toolID,
		Timestamp: time.Now().UTC(),
	})
}

// Complete marks the session as finished.
func (s *Session) Complete() {
	now := time.Now().UTC()
	s.CompletedAt = &now
}

// Serialize exports the session as JSON for audit trail.
func (s *Session) Serialize() ([]byte, error) {
	return json.MarshalIndent(s, "", "  ")
}

// TurnCount returns the number of conversation turns.
func (s *Session) TurnCount() int {
	return len(s.Messages)
}
