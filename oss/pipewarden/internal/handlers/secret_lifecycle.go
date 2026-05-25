package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ListSecretLifecycle handles GET /api/v1/secrets?status=active|revoked|expired
func (h *Handlers) ListSecretLifecycle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	status := r.URL.Query().Get("status")
	rows, err := h.db.ListSecretLifecycle(status)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if rows == nil {
		rows = []storage.SecretLifecycleRow{}
	}
	jsonOK(w, map[string]interface{}{"secrets": rows, "count": len(rows)})
}

// RevokeSecret handles POST /api/v1/secrets/{finding_id}/revoke
func (h *Handlers) RevokeSecret(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/secrets/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		jsonError(w, "finding_id required", http.StatusBadRequest)
		return
	}
	findingID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		jsonError(w, "invalid finding_id", http.StatusBadRequest)
		return
	}

	var req struct {
		Notes string `json:"notes"`
	}
	if decErr := json.NewDecoder(r.Body).Decode(&req); decErr != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if err := h.db.RevokeSecret(findingID, req.Notes); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonOK(w, map[string]interface{}{
		"finding_id": findingID,
		"status":     "revoked",
	})
}

// SecretLifecycleSummary handles GET /api/v1/secrets/summary
func (h *Handlers) SecretLifecycleSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	all, err := h.db.ListSecretLifecycle("")
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	counts := map[string]int{"active": 0, "revoked": 0, "expired": 0}
	var oldestActiveAge int
	now := time.Now().UTC()

	for _, row := range all {
		if _, ok := counts[row.Status]; ok {
			counts[row.Status]++
		}
		if row.Status == "active" {
			ageDays := int(now.Sub(row.FirstSeenAt).Hours() / 24)
			if ageDays > oldestActiveAge {
				oldestActiveAge = ageDays
			}
		}
	}

	jsonOK(w, map[string]interface{}{
		"counts":             counts,
		"oldest_active_days": oldestActiveAge,
		"total":              len(all),
	})
}
