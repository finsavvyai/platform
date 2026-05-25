package handlers

import (
	"context"
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/webhooks"
)

// recordAudit emits a tamper-proof audit event when the OpenSyber audit
// endpoint is configured. Failures are logged but do not block the caller —
// the audit trail is best-effort observability, never a hot-path dependency.
func (h *Handlers) recordAudit(ctx context.Context, action, actor, resource, resourceType string, details map[string]string) {
	if h.auditSender == nil {
		return
	}
	event := webhooks.AuditEvent{
		Action:       action,
		Actor:        actor,
		Resource:     resource,
		ResourceType: resourceType,
		Details:      details,
	}
	if err := h.auditSender.Send(ctx, event); err != nil {
		h.logger.Warnw("audit event delivery failed",
			"action", action,
			"resource", resource,
			"error", err,
		)
	}
}

// auditActor returns the user identifier from the request, falling back to
// the client IP when no JWT/session is bound. Header lookup matches
// middleware.RequestID so request-IDs are searchable across systems.
func auditActor(r *http.Request) string {
	if user := r.Header.Get("X-PipeWarden-User"); user != "" {
		return user
	}
	if rid := r.Header.Get("X-Request-ID"); rid != "" {
		return "anon:" + rid
	}
	return "anon"
}
