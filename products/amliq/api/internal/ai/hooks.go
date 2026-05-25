package ai

import (
	"context"
	"log"
	"time"
)

// HookEvent identifies when a hook fires.
type HookEvent int

const (
	HookPreToolUse HookEvent = iota
	HookPostToolUse
	HookPreScreen
	HookPostScreen
)

// HookResult determines whether to proceed or deny.
type HookResult struct {
	Allow   bool
	Message string
}

// Hook is a middleware function that runs before/after tool execution.
type Hook func(ctx context.Context, event HookEvent, data HookData) HookResult

// HookData carries context about the current operation.
type HookData struct {
	SessionID  string
	TenantID   string
	ToolName   string
	EntityName string
	Timestamp  time.Time
	Args       map[string]interface{}
	Result     interface{}
}

// HookPipeline manages ordered execution of hooks.
type HookPipeline struct {
	hooks []namedHook
}

type namedHook struct {
	name string
	fn   Hook
}

func NewHookPipeline() *HookPipeline {
	return &HookPipeline{}
}

// Register adds a hook to the pipeline.
func (hp *HookPipeline) Register(name string, fn Hook) {
	hp.hooks = append(hp.hooks, namedHook{name: name, fn: fn})
}

// Run executes all hooks for the given event. Returns deny if any hook denies.
func (hp *HookPipeline) Run(ctx context.Context, event HookEvent, data HookData) HookResult {
	for _, h := range hp.hooks {
		result := h.fn(ctx, event, data)
		if !result.Allow {
			log.Printf("hook %s denied: %s", h.name, result.Message)
			return result
		}
	}
	return HookResult{Allow: true}
}

// Built-in hooks are in hooks_builtin.go
