//go:build ignore

package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/openclaw"
)

// ─── OpenClaw Handler Responses ──────────────────────────────────────

func openClawResponse(w http.ResponseWriter, r *http.Request, status int, data interface{}) {
	requestID := uuid.New().String()
	response := map[string]interface{}{
		"success": status >= 200 && status < 300,
		"data":    data,
		"meta": map[string]interface{}{
			"request_id": requestID,
			"timestamp":  time.Now().Format(time.RFC3339),
			"version":    "v1",
			"service":    "sdlc-ai-gateway",
		},
	}
	w.WriteHeader(status)
	render.JSON(w, r, response)
}

func openClawError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	requestID := uuid.New().String()
	response := map[string]interface{}{
		"success": false,
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
		"meta": map[string]interface{}{
			"request_id": requestID,
			"timestamp":  time.Now().Format(time.RFC3339),
		},
	}
	w.WriteHeader(status)
	render.JSON(w, r, response)
}

// ─── Gateway Status & Health ─────────────────────────────────────────

// OpenClawStatus checks connectivity to the registered OpenClaw Gateway
func OpenClawStatus(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.Status")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		status, err := deps.OpenClaw.CheckStatus(ctx)
		if err != nil {
			openClawError(w, r, http.StatusInternalServerError, "STATUS_CHECK_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, status)
	}
}

// OpenClawIntegrationStatus returns detailed OpenClaw integration diagnostics
func OpenClawIntegrationStatus(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.IntegrationStatus")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		data := deps.OpenClaw.GetStatus()
		openClawResponse(w, r, http.StatusOK, data)
	}
}

// ─── Agent Hooks ─────────────────────────────────────────────────────

// OpenClawSendHook sends an agent hook to the OpenClaw Gateway
func OpenClawSendHook(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.SendHook")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		var payload openclaw.HookPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid JSON payload: "+err.Error())
			return
		}

		if payload.Message == "" {
			openClawError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "message is required")
			return
		}
		if payload.Name == "" {
			payload.Name = "SDLC-AI-Gateway"
		}

		resp, err := deps.OpenClaw.SendAgentHook(ctx, payload)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "HOOK_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, resp)
	}
}

// OpenClawSendWake sends a wake event to the OpenClaw Gateway
func OpenClawSendWake(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.SendWake")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		var req struct {
			Text string `json:"text"`
			Mode string `json:"mode"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid JSON payload: "+err.Error())
			return
		}

		if req.Text == "" {
			openClawError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "text is required")
			return
		}

		resp, err := deps.OpenClaw.SendWake(ctx, req.Text, req.Mode)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "WAKE_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, resp)
	}
}

// ─── Agent Dispatch ──────────────────────────────────────────────────

// OpenClawDispatch dispatches a Luna agent via the OpenClaw Gateway
func OpenClawDispatch(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.Dispatch")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		var req openclaw.DispatchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid JSON payload: "+err.Error())
			return
		}

		if req.Agent == "" {
			openClawError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "agent is required")
			return
		}
		if req.Context == "" {
			openClawError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "context is required")
			return
		}

		resp, err := deps.OpenClaw.Dispatch(ctx, req)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "DISPATCH_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, resp)
	}
}

// OpenClawSendMessage sends a custom message to the OpenClaw agent
func OpenClawSendMessage(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.SendMessage")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		var req struct {
			Message string `json:"message"`
			Channel string `json:"channel"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid JSON payload: "+err.Error())
			return
		}

		if req.Message == "" {
			openClawError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "message is required")
			return
		}

		resp, err := deps.OpenClaw.SendMessage(ctx, req.Message, req.Channel)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "MESSAGE_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, resp)
	}
}

// OpenClawListSessions lists active sessions on the OpenClaw Gateway
func OpenClawListSessions(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.ListSessions")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		sessions, err := deps.OpenClaw.ListSessions(ctx)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "SESSIONS_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, sessions)
	}
}

// ─── SDLC-AI Bridge Events ──────────────────────────────────────────

// OpenClawNotifyTestFailure notifies OpenClaw about a test failure
func OpenClawNotifyTestFailure(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.NotifyTestFailure")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		var event openclaw.TestFailureEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", err.Error())
			return
		}

		resp, err := deps.OpenClaw.OnTestFailed(ctx, event)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "NOTIFY_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, resp)
	}
}

// OpenClawNotifySuiteComplete notifies OpenClaw about a suite completion
func OpenClawNotifySuiteComplete(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.NotifySuiteComplete")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		var event openclaw.SuiteCompletionEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", err.Error())
			return
		}

		resp, err := deps.OpenClaw.OnSuiteCompleted(ctx, event)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "NOTIFY_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, resp)
	}
}

// OpenClawNotifySecurityAlert notifies OpenClaw about a security finding
func OpenClawNotifySecurityAlert(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.NotifySecurityAlert")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		var event openclaw.SecurityAlertEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", err.Error())
			return
		}

		resp, err := deps.OpenClaw.OnSecurityAlert(ctx, event)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "NOTIFY_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, resp)
	}
}

// OpenClawNotifySelfHealing notifies OpenClaw about a self-healing action
func OpenClawNotifySelfHealing(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.NotifySelfHealing")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		var event openclaw.SelfHealingEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", err.Error())
			return
		}

		resp, err := deps.OpenClaw.OnSelfHealing(ctx, event)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "NOTIFY_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, resp)
	}
}

// OpenClawDailySummary sends a daily summary to OpenClaw
func OpenClawDailySummary(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.DailySummary")
		defer span.End()

		if deps.OpenClaw == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "OPENCLAW_DISABLED", "OpenClaw integration is not configured")
			return
		}

		var stats openclaw.DailySummaryStats
		if err := json.NewDecoder(r.Body).Decode(&stats); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", err.Error())
			return
		}

		resp, err := deps.OpenClaw.SendDailySummary(ctx, stats)
		if err != nil {
			openClawError(w, r, http.StatusBadGateway, "SUMMARY_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, resp)
	}
}

// ─── Memory API (OpenClaw-Compatible) ────────────────────────────────

// MemoryStore stores a new memory entry
func MemoryStore(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.MemoryStore")
		defer span.End()

		if deps.Memory == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "MEMORY_DISABLED", "Memory service is not configured")
			return
		}

		var req openclaw.MemoryWriteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", err.Error())
			return
		}

		entry, err := deps.Memory.Write(ctx, req)
		if err != nil {
			openClawError(w, r, http.StatusInternalServerError, "WRITE_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusCreated, entry)
	}
}

// MemoryRead retrieves a memory entry by ID
func MemoryRead(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.MemoryRead")
		defer span.End()

		if deps.Memory == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "MEMORY_DISABLED", "Memory service is not configured")
			return
		}

		id := chi.URLParam(r, "id")
		if id == "" {
			openClawError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "id is required")
			return
		}

		entry, err := deps.Memory.Read(ctx, id)
		if err != nil {
			openClawError(w, r, http.StatusNotFound, "NOT_FOUND", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, entry)
	}
}

// MemoryDelete removes a memory entry
func MemoryDelete(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.MemoryDelete")
		defer span.End()

		if deps.Memory == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "MEMORY_DISABLED", "Memory service is not configured")
			return
		}

		id := chi.URLParam(r, "id")
		if id == "" {
			openClawError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "id is required")
			return
		}

		if err := deps.Memory.Delete(ctx, id); err != nil {
			openClawError(w, r, http.StatusNotFound, "NOT_FOUND", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, map[string]string{"deleted": id})
	}
}

// MemorySearch searches memory entries
func MemorySearch(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.MemorySearch")
		defer span.End()

		if deps.Memory == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "MEMORY_DISABLED", "Memory service is not configured")
			return
		}

		var req openclaw.MemorySearchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			openClawError(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", err.Error())
			return
		}

		results, err := deps.Memory.Search(ctx, req)
		if err != nil {
			openClawError(w, r, http.StatusInternalServerError, "SEARCH_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, map[string]interface{}{
			"results": results,
			"count":   len(results),
		})
	}
}

// MemoryList lists memory entries
func MemoryList(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.MemoryList")
		defer span.End()

		if deps.Memory == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "MEMORY_DISABLED", "Memory service is not configured")
			return
		}

		req := openclaw.MemorySearchRequest{
			UserID:    r.URL.Query().Get("user_id"),
			SessionID: r.URL.Query().Get("session_id"),
			Type:      r.URL.Query().Get("type"),
		}

		entries, err := deps.Memory.List(ctx, req)
		if err != nil {
			openClawError(w, r, http.StatusInternalServerError, "LIST_FAILED", err.Error())
			return
		}

		openClawResponse(w, r, http.StatusOK, map[string]interface{}{
			"entries": entries,
			"count":   len(entries),
		})
	}
}

// MemoryStatsHandler returns aggregate memory statistics
func MemoryStatsHandler(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.MemoryStats")
		defer span.End()

		if deps.Memory == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "MEMORY_DISABLED", "Memory service is not configured")
			return
		}

		stats := deps.Memory.GetStats(ctx)
		openClawResponse(w, r, http.StatusOK, stats)
	}
}

// MemoryExport exports a memory entry as Markdown
func MemoryExport(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "OpenClaw.MemoryExport")
		defer span.End()

		if deps.Memory == nil {
			openClawError(w, r, http.StatusServiceUnavailable, "MEMORY_DISABLED", "Memory service is not configured")
			return
		}

		id := chi.URLParam(r, "id")
		if id == "" {
			openClawError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "id is required")
			return
		}

		entry, err := deps.Memory.Read(ctx, id)
		if err != nil {
			openClawError(w, r, http.StatusNotFound, "NOT_FOUND", err.Error())
			return
		}

		markdown := deps.Memory.ExportToMarkdown(entry)

		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=memory-"+id+".md")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(markdown))
	}
}
