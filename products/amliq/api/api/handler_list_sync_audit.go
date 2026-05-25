package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	spgx "github.com/aegis-aml/aegis/internal/storage/pgx"
)

// ListSyncAuditHandler serves the /admin/list-health page — recent
// sync attempts across tenants & lists, with filters by list_id,
// status, and a limit.
type ListSyncAuditHandler struct {
	db *sql.DB
}

// NewListSyncAuditHandler constructs the handler.
func NewListSyncAuditHandler(db *sql.DB) *ListSyncAuditHandler {
	return &ListSyncAuditHandler{db: db}
}

// List handles GET /api/v1/admin/list-sync-audit.
func (h *ListSyncAuditHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	filter := spgx.AuditFilter{
		ListID:   q.Get("list_id"),
		TenantID: q.Get("tenant_id"),
		Status:   q.Get("status"),
		Limit:    limit,
	}
	rows, err := spgx.ListRecent(r.Context(), h.db, filter)
	if err != nil {
		http.Error(w, "query list_sync_audit: "+err.Error(),
			http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"rows":  rows,
		"count": len(rows),
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
