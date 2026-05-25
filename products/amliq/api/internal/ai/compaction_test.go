package ai

import "testing"

func TestCompactionSkipsShortSession(t *testing.T) {
	s := NewSession("tnt_001", "Test")
	for i := 0; i < 10; i++ {
		s.AddMessage(RoleAssistant, "message")
	}

	cfg := CompactionConfig{MaxMessages: 50, PreserveRecent: 5}
	result := Compact(s, cfg)

	if result.TurnCount() != 10 {
		t.Errorf("short session should not be compacted, got %d turns", result.TurnCount())
	}
}

func TestCompactionTriggersOnLongSession(t *testing.T) {
	s := NewSession("tnt_001", "Test Entity")
	for i := 0; i < 60; i++ {
		s.AddMessage(RoleAssistant, "screening result")
	}

	cfg := CompactionConfig{MaxMessages: 50, PreserveRecent: 10}
	result := Compact(s, cfg)

	// Should have: 1 summary + 10 recent = 11
	if result.TurnCount() != 11 {
		t.Errorf("compacted session should have 11 turns, got %d", result.TurnCount())
	}
	if result.Messages[0].Role != RoleSystem {
		t.Error("first message should be system summary")
	}
}

func TestCompactionPreservesMeta(t *testing.T) {
	s := NewSession("tnt_001", "Test")
	s.TokensUsed = 5000
	for i := 0; i < 60; i++ {
		s.AddMessage(RoleAssistant, "msg")
	}

	result := Compact(s, DefaultCompactionConfig())
	if result.ID != s.ID {
		t.Error("compaction should preserve session ID")
	}
	if result.TokensUsed != 5000 {
		t.Error("compaction should preserve token count")
	}
}
