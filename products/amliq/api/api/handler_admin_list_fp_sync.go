package api

import (
	"fmt"
	"net/http"

	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/tasklog"
)

// SyncListFingerprints rebuilds fingerprints for a single sanctions list.
// POST /api/v1/admin/lists/{id}/sync-fingerprints
func (h *AdminOpsHandler) SyncListFingerprints(
	w http.ResponseWriter, r *http.Request,
) {
	listID := r.PathValue("id")
	if listID == "" {
		Error(w, "INVALID_PARAMS", "list id required",
			http.StatusBadRequest)
		return
	}
	actor := actorFromRequest(r)
	taskID := h.registry.Start(
		"sync_fingerprints:"+listID, "manual", actor, "")

	go func() {
		n, err := screening.PopulateFingerprintsByList(h.db, listID)
		out := fmt.Sprintf("%d fingerprints rebuilt for %s", n, listID)
		if err != nil {
			h.registry.Complete(
				taskID, tasklog.StatusFailed, out, err.Error())
			return
		}
		h.registry.Complete(taskID, tasklog.StatusSuccess, out, "")
	}()

	Success(w, map[string]interface{}{
		"task_id": taskID,
		"list_id": listID,
		"message": "fingerprint sync started",
	}, http.StatusAccepted)
}
