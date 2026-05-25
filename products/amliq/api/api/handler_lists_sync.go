package api

import (
	"context"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
)

// SyncListHandler handles manual list sync triggers.
type SyncListHandler struct {
	tenants TenantGetter
	syncSvc *ingestion.SyncService
	audit   AuditCreator
}

// TenantGetter retrieves a tenant by ID (subset of TenantRepository).
type TenantGetter interface {
	GetByID(id domain.TenantID) (*domain.Tenant, error)
}

// AuditCreator appends audit entries (subset of AuditRepository).
type AuditCreator interface {
	Create(entry domain.AuditEntry) error
}

// NewSyncListHandler creates a handler for manual sync triggers.
func NewSyncListHandler(
	tenants TenantGetter,
	syncSvc *ingestion.SyncService,
	audit AuditCreator,
) *SyncListHandler {
	return &SyncListHandler{
		tenants: tenants,
		syncSvc: syncSvc,
		audit:   audit,
	}
}

// TriggerSync handles POST /api/v1/lists/{id}/sync.
func (h *SyncListHandler) TriggerSync(w http.ResponseWriter, r *http.Request) {
	tenantID, listID, err := h.extractParams(r)
	if err != nil {
		Error(w, "INVALID_PARAMS", err.Error(), http.StatusBadRequest)
		return
	}

	tenant, listCfg, err := h.findList(tenantID, listID)
	if err != nil {
		Error(w, "NOT_FOUND", err.Error(), http.StatusNotFound)
		return
	}
	_ = tenant

	ctx := context.Background()
	if err := h.syncSvc.SyncList(ctx, tenantID, *listCfg); err != nil {
		Error(w, "SYNC_FAILED", err.Error(), http.StatusInternalServerError)
		return
	}
	InvalidateListCounts()

	Success(w, map[string]interface{}{
		"list_id": listID,
		"status":  "completed",
	}, http.StatusOK)
}
