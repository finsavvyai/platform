package api

import (
	"context"
	"log"
	"net/http"
	"sync/atomic"

	"github.com/aegis-aml/aegis/internal/ingestion"
)

// RefreshHandler handles admin-triggered bulk list refresh.
type RefreshHandler struct {
	refreshSvc *ingestion.RefreshService
	audit      AuditCreator
	running    atomic.Bool
}

// NewRefreshHandler creates a handler for manual refresh triggers.
func NewRefreshHandler(
	refreshSvc *ingestion.RefreshService,
	audit AuditCreator,
) *RefreshHandler {
	return &RefreshHandler{
		refreshSvc: refreshSvc,
		audit:      audit,
	}
}

// TriggerRefresh handles POST /api/v1/admin/lists/refresh.
// Returns 202 Accepted and runs the refresh asynchronously.
func (h *RefreshHandler) TriggerRefresh(w http.ResponseWriter, r *http.Request) {
	if !h.running.CompareAndSwap(false, true) {
		Error(w, "REFRESH_IN_PROGRESS",
			"a refresh is already running", http.StatusConflict)
		return
	}

	go h.runRefresh()

	Success(w, map[string]interface{}{
		"status":  "accepted",
		"message": "list refresh started",
	}, http.StatusAccepted)
}

func (h *RefreshHandler) runRefresh() {
	defer h.running.Store(false)

	ctx := context.Background()
	total, err := h.refreshSvc.RefreshAllLists(ctx)
	if err != nil {
		log.Printf("manual refresh error: %v", err)
		return
	}
	InvalidateListCounts()
	log.Printf("manual refresh completed: %d list-tenant syncs", total)
}
