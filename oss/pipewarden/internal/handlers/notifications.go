package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ListNotifications handles GET /api/v1/notifications
func (h *Handlers) ListNotifications(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	unreadOnly := q.Get("unread") == "true"

	limit := 20
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}

	notifications, err := h.db.ListNotifications(unreadOnly, limit)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if notifications == nil {
		notifications = []storage.NotificationRow{}
	}

	jsonOK(w, map[string]interface{}{
		"notifications": notifications,
		"count":         len(notifications),
	})
}

// MarkNotificationRead handles POST /api/v1/notifications/{id}/read
func (h *Handlers) MarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	idStr := extractNotificationID(r.URL.Path)
	if idStr == "" {
		jsonError(w, "missing notification id", http.StatusBadRequest)
		return
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, "invalid notification id", http.StatusBadRequest)
		return
	}

	if err := h.db.MarkRead(id); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonOK(w, map[string]interface{}{"id": id, "read": true})
}

// MarkAllNotificationsRead handles POST /api/v1/notifications/read-all
func (h *Handlers) MarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	if err := h.db.MarkAllRead(); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

// NotificationCount handles GET /api/v1/notifications/count
func (h *Handlers) NotificationCount(w http.ResponseWriter, r *http.Request) {
	count, err := h.db.UnreadCount()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]int{"unread": count})
}

// extractNotificationID pulls the numeric ID from /api/v1/notifications/{id}/read
func extractNotificationID(path string) string {
	path = strings.TrimPrefix(path, "/api/v1/notifications/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) == 0 {
		return ""
	}
	return parts[0]
}
