package ai

import (
	"context"
	"fmt"
	"log"
	"time"
)

// ToolExecutor runs MCP tools and returns results.
type ToolExecutor interface {
	Execute(ctx context.Context, toolName string, args map[string]interface{}) (string, error)
}

// Orchestrator manages multi-turn AI screening workflows.
type Orchestrator struct {
	executor   ToolExecutor
	hooks      *HookPipeline
	compaction CompactionConfig
}

func NewOrchestrator(executor ToolExecutor, hooks *HookPipeline) *Orchestrator {
	if hooks == nil {
		hooks = NewHookPipeline()
	}
	return &Orchestrator{
		executor:   executor,
		hooks:      hooks,
		compaction: DefaultCompactionConfig(),
	}
}

// ScreenEntity runs a full multi-turn screening workflow.
// Guards entity name against prompt injection before LLM processing.
func (o *Orchestrator) ScreenEntity(
	ctx context.Context, tenantID, entityName string,
) (*Session, error) {
	if err := guardInput(ctx, entityName); err != nil {
		return nil, fmt.Errorf("entity name rejected: %w", err)
	}
	session := NewSession(tenantID, entityName)
	session.AddMessage(RoleSystem, buildScreeningPrompt(entityName))

	steps := []screeningStep{
		{"screen_entity", map[string]interface{}{"name": entityName}},
		{"check_pep", map[string]interface{}{"name": entityName}},
		{"search_enforcement", map[string]interface{}{"name": entityName}},
	}

	for _, step := range steps {
		if err := o.executeStep(ctx, session, step); err != nil {
			log.Printf("orchestrator: step %s error: %v", step.tool, err)
		}
	}

	session.Complete()
	return session, nil
}

type screeningStep struct {
	tool string
	args map[string]interface{}
}

func (o *Orchestrator) executeStep(
	ctx context.Context, session *Session, step screeningStep,
) error {
	hookData := HookData{
		SessionID:  session.ID,
		TenantID:   session.TenantID,
		ToolName:   step.tool,
		EntityName: session.EntityName,
		Timestamp:  time.Now().UTC(),
		Args:       step.args,
	}

	result := o.hooks.Run(ctx, HookPreToolUse, hookData)
	if !result.Allow {
		return fmt.Errorf("hook denied: %s", result.Message)
	}

	toolResult, err := o.executor.Execute(ctx, step.tool, step.args)
	if err != nil {
		return err
	}

	session.AddToolResult(step.tool, toolResult)
	hookData.Result = toolResult
	o.hooks.Run(ctx, HookPostToolUse, hookData)

	// Compact if session is getting long
	compacted := Compact(session, o.compaction)
	*session = *compacted

	return nil
}

// BatchScreen and prompt builders are in orchestrator_batch.go
