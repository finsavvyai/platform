package handlers

import (
	"net/http"
	"strconv"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ListAuditLog handles GET /api/v1/audit
func (h *Handlers) ListAuditLog(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	action := q.Get("action")
	resource := q.Get("resource")

	limit := 50
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if limit > 200 {
		limit = 200
	}

	offset := 0
	if v := q.Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	entries, err := h.db.ListAuditLog(action, resource, limit, offset)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	total, err := h.db.CountAuditLog(action, resource)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if entries == nil {
		entries = []storage.AuditLogRow{}
	}

	jsonOK(w, map[string]interface{}{
		"entries": entries,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}
