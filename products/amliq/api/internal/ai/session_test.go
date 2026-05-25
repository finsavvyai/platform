package ai

import (
	"encoding/json"
	"testing"
)

func TestNewSession(t *testing.T) {
	s := NewSession("tnt_001", "John Smith")
	if s.ID == "" {
		t.Error("session ID should not be empty")
	}
	if s.TenantID != "tnt_001" {
		t.Errorf("tenant = %s, want tnt_001", s.TenantID)
	}
	if s.EntityName != "John Smith" {
		t.Errorf("entity = %s, want John Smith", s.EntityName)
	}
}

func TestSessionAddMessages(t *testing.T) {
	s := NewSession("tnt_001", "Test")
	s.AddMessage(RoleSystem, "system prompt")
	s.AddMessage(RoleUser, "screen this entity")
	s.AddToolResult("tool_1", `{"match": true}`)

	if s.TurnCount() != 3 {
		t.Errorf("turns = %d, want 3", s.TurnCount())
	}
	if s.Messages[2].ToolID != "tool_1" {
		t.Error("tool result should have tool ID")
	}
}

func TestSessionSerialize(t *testing.T) {
	s := NewSession("tnt_001", "Test")
	s.AddMessage(RoleAssistant, "screening complete")
	s.Complete()

	data, err := s.Serialize()
	if err != nil {
		t.Fatalf("serialize error: %v", err)
	}

	var parsed Session
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("deserialize error: %v", err)
	}
	if parsed.CompletedAt == nil {
		t.Error("completed_at should be set")
	}
}
