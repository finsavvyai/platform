package api

import (
	"database/sql"
	"net/http"
	"time"
)

type HealthHandler struct {
	db      *sql.DB
	version string
}

func NewHealthHandler(db *sql.DB, version string) *HealthHandler {
	return &HealthHandler{db: db, version: version}
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	Success(w, map[string]interface{}{
		"status":  "healthy",
		"version": h.version,
		"time":    time.Now().UTC().Format(time.RFC3339),
	}, http.StatusOK)
}

func (h *HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := h.db.PingContext(ctx); err != nil {
		Error(w, "DB_UNAVAILABLE", "database not reachable",
			http.StatusServiceUnavailable)
		return
	}
	var one int
	if err := h.db.QueryRowContext(ctx, "SELECT 1").Scan(&one); err != nil {
		Error(w, "DB_QUERY_FAILED", "database query failed",
			http.StatusServiceUnavailable)
		return
	}
	Success(w, map[string]interface{}{
		"ready":    true,
		"database": "connected",
	}, http.StatusOK)
}
