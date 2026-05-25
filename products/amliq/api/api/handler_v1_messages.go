package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/storage"
)

// handleV1Messages serves the Anthropic Messages API drop-in at
// POST /v1/messages. Pipeline mirrors /api/v1/ai/summarize but
// without the {alert,case,adverse_media} type gate — callers send
// arbitrary message arrays. DLP scrub still runs on every message
// because the value of this endpoint over direct Anthropic IS the
// scrub. Auth via X-API-Key (apiKeyAuth middleware on the route).
func handleV1Messages(deps aiHandlerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			Error(w, "MISSING_AUTH", "auth required",
				http.StatusUnauthorized)
			return
		}
		var req AnthropicMessagesRequest
		if err := DecodeJSON(r, &req); err != nil {
			Error(w, "BAD_REQUEST", "invalid body", http.StatusBadRequest)
			return
		}
		prompt, err := buildV1MessagesPrompt(req)
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
		modelName := defaultModel(req.Model)
		// Streaming: buffer-then-scrub-then-emit. See
		// handler_v1_messages_stream.go for why we don't true-stream.
		if req.Stream {
			if !deps.client.IsConfigured() {
				Error(w, "AI_UNAVAILABLE",
					"AI provider not configured",
					http.StatusServiceUnavailable)
				return
			}
			if err := writeMessagesAudit(deps.audit, claims); err != nil {
				Error(w, "AUDIT_FAILED", "audit write failed",
					http.StatusInternalServerError)
				return
			}
			if deps.quota != nil {
				deps.quota.Record(claims.TenantID, claims.UserID)
			}
			streamAnthropicResponse(r.Context(), w, deps, claims,
				prompt, modelName, "v1_messages")
			return
		}
		if cached, hit, _ := cacheGet(deps.cache, claims.TenantID, prompt); hit {
			if err := writeMessagesAudit(deps.audit, claims); err != nil {
				Error(w, "AUDIT_FAILED", "audit write failed",
					http.StatusInternalServerError)
				return
			}
			recordAIRequest(deps.reqLog, buildSuccessLog(claims.TenantID,
				claims.UserID, "cache", modelName, "v1_messages",
				prompt, cached, 0, true))
			writeAnthropicResponse(w, prompt, cached, req.Model)
			return
		}
		if !deps.client.IsConfigured() {
			Error(w, "AI_UNAVAILABLE", "AI provider not configured",
				http.StatusServiceUnavailable)
			return
		}
		started := time.Now()
		text, err := deps.client.Complete(r.Context(), prompt)
		latency := time.Since(started)
		if err != nil {
			recordAIRequest(deps.reqLog, buildErrorLog(claims.TenantID,
				claims.UserID, providerNameOf(deps.client), modelName,
				"v1_messages", prompt, classifyError(err), latency))
			Error(w, "AI_ERROR", "completion failed",
				http.StatusBadGateway)
			return
		}
		if err := writeMessagesAudit(deps.audit, claims); err != nil {
			Error(w, "AUDIT_FAILED", "audit write failed",
				http.StatusInternalServerError)
			return
		}
		if deps.quota != nil {
			deps.quota.Record(claims.TenantID, claims.UserID)
		}
		cacheSet(deps.cache, claims.TenantID, prompt, text)
		recordAIRequest(deps.reqLog, buildSuccessLog(claims.TenantID,
			claims.UserID, providerNameOf(deps.client), modelName,
			"v1_messages", prompt, text, latency, false))
		writeAnthropicResponse(w, prompt, text, req.Model)
	}
}

// writeMessagesAudit forwards to writeAIAudit with summary_type set
// to "v1_messages" so observability rollups can distinguish drop-in
// usage from the AML-shaped /summarize endpoint.
func writeMessagesAudit(audit storage.AuditRepository, claims *Claims) error {
	return writeAIAudit(audit, claims, "v1_messages")
}
