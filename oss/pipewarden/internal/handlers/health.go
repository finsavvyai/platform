package handlers

import (
	"net/http"
)

// Health handles GET /health
func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	dbHealthy := h.db != nil && h.db.Ping() == nil
	vaultHealthy := h.vault != nil
	status := "ok"
	if !dbHealthy {
		status = "degraded"
	}

	jsonOK(w, map[string]interface{}{
		"status": status,
		"checks": map[string]bool{
			"database": dbHealthy,
			"vault":    vaultHealthy,
		},
	})
}
