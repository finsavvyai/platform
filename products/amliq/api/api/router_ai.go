package api

import "net/http"

// setupAIRoutes mounts the AML AI summarization endpoint that
// amliq-frontend's src/api/ai.ts already calls + the Anthropic
// Messages API drop-in. Both share the same backend selection
// (newAnthropicSummarizer prefers Bedrock when configured, falls
// back to Anthropic). The handler 503s when no provider is
// configured rather than 500ing.
func setupAIRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	aiDeps := newAIHandlerDeps(deps)
	mux.Handle("POST /api/v1/ai/summarize",
		authChain(handleAISummarize(aiDeps)))
	mux.Handle("POST /v1/messages",
		authChain(handleV1Messages(aiDeps)))
	if deps.AIRequestLog != nil {
		teamAdmin := AdminOnly()
		mux.Handle("GET /api/v1/ai/requests",
			authChain(teamAdmin(handleAIRequestsList(deps.AIRequestLog))))
		mux.Handle("GET /api/v1/team/ai-cost",
			authChain(teamAdmin(handleAICost(deps.AIRequestLog))))
	}
}
