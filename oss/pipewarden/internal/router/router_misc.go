package router

import (
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/handlers"
)

// notificationActionHandler routes POST /api/v1/notifications/{id}/read.
func notificationActionHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if strings.HasSuffix(r.URL.Path, "/read") {
			h.MarkNotificationRead(w, r)
			return
		}
		http.NotFound(w, r)
	}
}

// secretLifecycleActionHandler routes POST /api/v1/secrets/{finding_id}/revoke.
func secretLifecycleActionHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/revoke") {
			http.NotFound(w, r)
			return
		}
		mustPost(h.RevokeSecret)(w, r)
	}
}

// webhookTemplateCollectionHandler routes GET/POST /api/v1/webhooks/templates.
func webhookTemplateCollectionHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.ListWebhookTemplates(w, r)
		case http.MethodPost:
			h.CreateWebhookTemplate(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// webhookTemplateDetailHandler routes POST /api/v1/webhooks/templates/{id}/render.
func webhookTemplateDetailHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/render") {
			http.NotFound(w, r)
			return
		}
		mustPost(h.RenderWebhookTemplate)(w, r)
	}
}

// teamMembersHandler routes GET/POST /api/v1/team/members.
func teamMembersHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.ListTeamMembers(w, r)
		case http.MethodPost:
			h.InviteTeamMember(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// teamMemberDetailHandler routes /api/v1/team/members/{email} and /role sub-path.
func teamMemberDetailHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/role") {
			if r.Method != http.MethodPut {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			h.UpdateTeamMemberRole(w, r)
			return
		}
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		h.RemoveTeamMember(w, r)
	}
}
