package api

import (
	"context"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/ai"
)

// AISummarizer is the slice of *ai.AnthropicClient we depend on. Lets
// tests inject a fake without standing up the real HTTP client.
type AISummarizer interface {
	IsConfigured() bool
	Complete(ctx context.Context, prompt string) (string, error)
}

// AISummaryRequest is the contract amliq-frontend already calls.
// Keep field names exactly: src/api/ai.ts:30 sends {text, type}.
type AISummaryRequest struct {
	Text string `json:"text"`
	Type string `json:"type"`
}

// AISummaryResponse mirrors src/api/ai.ts:4. Adding new fields is
// fine; renaming these breaks the frontend.
type AISummaryResponse struct {
	Summary string `json:"summary"`
	Model   string `json:"model"`
}

// summarizeInput is the prepared payload after sanitize + DLP scrub.
type summarizeInput struct {
	cleaned string
	prompt  string
}

const (
	maxAITextChars = 4000
	aiModelTag     = "claude-haiku-4-5"
)

// handleAISummarize wires the AML summarization endpoint amliq-frontend
// expects at POST /api/v1/ai/summarize. Pipeline: auth → sanitize →
// MaskPII → prompt template → Anthropic → audit. Audit-write failures
// fail the request (fail-closed) so a missing Append never lets a
// silent "AI saw a customer alert" event escape.
func handleAISummarize(deps aiHandlerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			Error(w, "MISSING_AUTH", "auth required", http.StatusUnauthorized)
			return
		}
		var req AISummaryRequest
		if err := DecodeJSON(r, &req); err != nil {
			Error(w, "BAD_REQUEST", "invalid body", http.StatusBadRequest)
			return
		}
		input, err := prepareAISummaryInput(req)
		if err != nil {
			Error(w, "BAD_REQUEST", err.Error(), http.StatusBadRequest)
			return
		}
		if deps.quota != nil && !deps.quota.Allow(claims.TenantID, claims.UserID) {
			Error(w, "AI_QUOTA_EXCEEDED",
				"daily AI call cap reached (tenant or per-seat)",
				http.StatusTooManyRequests)
			return
		}
		// Cache lookup: same scrubbed prompt for the same tenant
		// returns the same response without re-billing the model.
		// Cached hits still record in the request log (with cached=true)
		// so the per-call audit trail stays complete.
		if cached, hit, _ := ai.CacheLookup(deps.cache, r.Context(),
			claims.TenantID, input.prompt); hit {
			if err := writeAIAudit(deps.audit, claims, req.Type); err != nil {
				Error(w, "AUDIT_FAILED", "audit write failed",
					http.StatusInternalServerError)
				return
			}
			recordAIRequest(deps.reqLog, buildSuccessLog(claims.TenantID,
				claims.UserID, "cache", aiModelTag, req.Type,
				input.prompt, cached, 0, true))
			Success(w, AISummaryResponse{Summary: cached, Model: aiModelTag},
				http.StatusOK)
			return
		}
		if !deps.client.IsConfigured() {
			Error(w, "AI_UNAVAILABLE", "AI provider not configured",
				http.StatusServiceUnavailable)
			return
		}
		started := time.Now()
		summary, err := deps.client.Complete(r.Context(), input.prompt)
		latency := time.Since(started)
		if err != nil {
			recordAIRequest(deps.reqLog, buildErrorLog(claims.TenantID,
				claims.UserID, providerNameOf(deps.client), aiModelTag,
				req.Type, input.prompt, classifyError(err), latency))
			Error(w, "AI_ERROR", "summarization failed",
				http.StatusBadGateway)
			return
		}
		if err := writeAIAudit(deps.audit, claims, req.Type); err != nil {
			Error(w, "AUDIT_FAILED", "audit write failed",
				http.StatusInternalServerError)
			return
		}
		if deps.quota != nil {
			deps.quota.Record(claims.TenantID, claims.UserID)
		}
		if deps.cache != nil {
			deps.cache.Set(deps.cache.Key(claims.TenantID, input.prompt), summary)
		}
		recordAIRequest(deps.reqLog, buildSuccessLog(claims.TenantID,
			claims.UserID, providerNameOf(deps.client), aiModelTag,
			req.Type, input.prompt, summary, latency, false))
		Success(w, AISummaryResponse{Summary: summary, Model: aiModelTag},
			http.StatusOK)
	}
}

// prepareAISummaryInput is implemented in handler_ai_prepare.go.
