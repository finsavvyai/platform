package ai

import (
	"context"
	"testing"
)

type mockExecutor struct {
	calls []string
}

func (m *mockExecutor) Execute(_ context.Context, tool string, _ map[string]interface{}) (string, error) {
	m.calls = append(m.calls, tool)
	return `{"match": false, "total": 0}`, nil
}

func TestOrchestratorScreenEntity(t *testing.T) {
	executor := &mockExecutor{}
	hooks := NewHookPipeline()
	hooks.Register("audit", AuditHook())

	orch := NewOrchestrator(executor, hooks)
	session, err := orch.ScreenEntity(context.Background(), "tnt_001", "John Smith")
	if err != nil {
		t.Fatalf("ScreenEntity error: %v", err)
	}

	if len(executor.calls) != 3 {
		t.Errorf("expected 3 tool calls, got %d: %v", len(executor.calls), executor.calls)
	}
	if executor.calls[0] != "screen_entity" {
		t.Errorf("first call should be screen_entity, got %s", executor.calls[0])
	}
	if executor.calls[1] != "check_pep" {
		t.Errorf("second call should be check_pep, got %s", executor.calls[1])
	}
	if session.CompletedAt == nil {
		t.Error("session should be completed")
	}
}

func TestOrchestratorBatchScreen(t *testing.T) {
	executor := &mockExecutor{}
	orch := NewOrchestrator(executor, nil)

	entities := []string{"John Smith", "Jane Doe", "Acme Corp"}
	sessions, err := orch.BatchScreen(context.Background(), "tnt_001", entities)
	if err != nil {
		t.Fatalf("BatchScreen error: %v", err)
	}

	if len(sessions) != 3 {
		t.Errorf("expected 3 sessions, got %d", len(sessions))
	}
	// 3 entities * 3 tools each = 9 calls
	if len(executor.calls) != 9 {
		t.Errorf("expected 9 tool calls, got %d", len(executor.calls))
	}
}

func TestOrchestratorHookDenial(t *testing.T) {
	executor := &mockExecutor{}
	hooks := NewHookPipeline()
	hooks.Register("block", PermissionHook(map[string]bool{})) // deny all

	orch := NewOrchestrator(executor, hooks)
	session, _ := orch.ScreenEntity(context.Background(), "tnt_001", "Test")

	if len(executor.calls) != 0 {
		t.Error("executor should not be called when hooks deny")
	}
	if session.CompletedAt == nil {
		t.Error("session should still complete")
	}
}
