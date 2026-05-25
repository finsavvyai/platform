package ai

import (
	"context"
	"testing"
)

func TestAuditHookAllows(t *testing.T) {
	hook := AuditHook()
	result := hook(context.Background(), HookPreToolUse, HookData{
		SessionID: "sess_1", ToolName: "screen_entity",
	})
	if !result.Allow {
		t.Error("audit hook should always allow")
	}
}

func TestPermissionHookDenies(t *testing.T) {
	allowed := map[string]bool{"screen_entity": true, "check_pep": true}
	hook := PermissionHook(allowed)

	tests := []struct {
		tool  string
		allow bool
	}{
		{"screen_entity", true},
		{"check_pep", true},
		{"create_case", false},
		{"generate_sar", false},
	}
	for _, tt := range tests {
		result := hook(context.Background(), HookPreToolUse, HookData{ToolName: tt.tool})
		if result.Allow != tt.allow {
			t.Errorf("tool %s: allow=%v, want %v", tt.tool, result.Allow, tt.allow)
		}
	}
}

func TestHookPipelineDeniesOnFirst(t *testing.T) {
	pipeline := NewHookPipeline()
	pipeline.Register("deny_all", func(_ context.Context, _ HookEvent, _ HookData) HookResult {
		return HookResult{Allow: false, Message: "blocked"}
	})
	pipeline.Register("audit", AuditHook())

	result := pipeline.Run(context.Background(), HookPreToolUse, HookData{})
	if result.Allow {
		t.Error("pipeline should deny when first hook denies")
	}
}

func TestHookPipelineAllowsAll(t *testing.T) {
	pipeline := NewHookPipeline()
	pipeline.Register("audit", AuditHook())
	pipeline.Register("perm", PermissionHook(map[string]bool{"screen_entity": true}))

	result := pipeline.Run(context.Background(), HookPreToolUse, HookData{ToolName: "screen_entity"})
	if !result.Allow {
		t.Error("pipeline should allow when all hooks allow")
	}
}
