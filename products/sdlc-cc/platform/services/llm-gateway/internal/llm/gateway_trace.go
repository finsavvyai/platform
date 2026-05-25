package llm

import (
	"context"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// traceCompletion forwards a successful completion to Langfuse. The call is a
// no-op when the Langfuse client is disabled (missing env vars) so it is safe
// to invoke unconditionally from the Complete() hot path.
func (g *Gateway) traceCompletion(
	ctx context.Context,
	req *models.CompletionRequest,
	response *models.CompletionResponse,
) {
	if g.langfuse == nil {
		return
	}
	g.langfuse.TraceGeneration(ctx, "llm-gateway.complete", req.Messages, response.Choices, map[string]interface{}{
		"provider":  response.Provider,
		"model":     response.Model,
		"tenant_id": req.TenantID,
		"user_id":   req.UserID,
		"usage": map[string]int{
			"prompt_tokens":     response.Usage.PromptTokens,
			"completion_tokens": response.Usage.CompletionTokens,
			"total_tokens":      response.Usage.TotalTokens,
		},
		"cost_usd": response.Cost,
	})
}

// Close releases gateway-owned resources (e.g. Langfuse buffered events).
// Safe to call multiple times; safe when observability is disabled.
func (g *Gateway) Close() error {
	if g.langfuse != nil {
		return g.langfuse.Close()
	}
	return nil
}
