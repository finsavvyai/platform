package ai

import (
	"context"
	"log"
)

// AuditHook logs every tool execution for compliance.
func AuditHook() Hook {
	return func(_ context.Context, event HookEvent, data HookData) HookResult {
		log.Printf("AUDIT [%s] session=%s tenant=%s tool=%s entity=%s",
			eventName(event), data.SessionID, data.TenantID,
			data.ToolName, data.EntityName)
		return HookResult{Allow: true}
	}
}

// PermissionHook enforces role-based tool access.
func PermissionHook(allowedTools map[string]bool) Hook {
	return func(_ context.Context, event HookEvent, data HookData) HookResult {
		if event != HookPreToolUse {
			return HookResult{Allow: true}
		}
		if !allowedTools[data.ToolName] {
			return HookResult{Allow: false, Message: "tool not permitted for role"}
		}
		return HookResult{Allow: true}
	}
}

func eventName(e HookEvent) string {
	switch e {
	case HookPreToolUse:
		return "pre_tool"
	case HookPostToolUse:
		return "post_tool"
	case HookPreScreen:
		return "pre_screen"
	case HookPostScreen:
		return "post_screen"
	default:
		return "unknown"
	}
}
