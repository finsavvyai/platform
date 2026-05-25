package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/tasklog"
)

// CryptoSyncHandler handles admin-triggered crypto wallet sync.
type CryptoSyncHandler struct {
	syncSvc  *ingestion.CryptoSyncService
	registry *tasklog.Registry
}

// NewCryptoSyncHandler creates a handler for crypto sync operations.
func NewCryptoSyncHandler(
	svc *ingestion.CryptoSyncService,
	reg *tasklog.Registry,
) *CryptoSyncHandler {
	return &CryptoSyncHandler{syncSvc: svc, registry: reg}
}

// SyncAll triggers a full crypto wallet sync from all sources.
// POST /api/v1/admin/ops/sync-crypto
func (h *CryptoSyncHandler) SyncAll(
	w http.ResponseWriter, r *http.Request,
) {
	actor := actorFromRequest(r)
	taskID := h.registry.Start(
		"sync_crypto", "manual", actor, "")

	go func() {
		ctx, cancel := context.WithTimeout(
			context.Background(), 10*time.Minute)
		defer cancel()

		result := h.syncSvc.SyncAll(ctx)

		status := tasklog.StatusSuccess
		errMsg := ""
		if len(result.Errors) > 0 {
			status = tasklog.StatusFailed
			errMsg = result.Errors[0]
		}

		h.registry.Complete(taskID, status,
			formatCryptoResult(result), errMsg)
	}()

	Success(w, map[string]interface{}{
		"task_id": taskID,
		"message": "crypto wallet sync started",
		"sources": len(ingestion.CryptoSources),
	}, http.StatusAccepted)
}

func formatCryptoResult(r ingestion.CryptoRefreshResult) string {
	return fmt.Sprintf("loaded %d wallets from %d sources in %v",
		r.TotalLoaded, len(r.BySource), r.Duration)
}
