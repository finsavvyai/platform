package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// ListToggleHandler handles enable/disable for marketplace lists.
type ListToggleHandler struct {
	tenants storage.TenantRepository
}

func NewListToggleHandler(tenants storage.TenantRepository) *ListToggleHandler {
	return &ListToggleHandler{tenants: tenants}
}

func (h *ListToggleHandler) Enable(w http.ResponseWriter, r *http.Request) {
	listID := PathParam(r, "listId")
	tenant, err := h.loadTenant(r)
	if err != nil || tenant == nil {
		Error(w, "TENANT_ERROR", "cannot load tenant", http.StatusBadRequest)
		return
	}

	entry := domain.FindMarketplaceEntry(listID)
	if entry == nil {
		Error(w, "NOT_FOUND", "list not found in catalog", http.StatusNotFound)
		return
	}

	for _, lc := range tenant.Config.EnabledLists {
		if lc.ListID == listID {
			Success(w, map[string]string{"status": "already_enabled"}, http.StatusOK)
			return
		}
	}

	lc := domain.ListConfig{
		ListID:       entry.ID,
		SourceURL:    entry.SourceURL,
		ParserType:   entry.ParserType,
		SyncEnabled:  true,
		SyncSchedule: domain.DefaultSyncSchedule,
		Threshold:    0.7,
	}
	tenant.Config.EnabledLists = append(tenant.Config.EnabledLists, lc)
	if err := h.tenants.Update(*tenant); err != nil {
		Error(w, "DB_ERROR", "failed to enable list", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]string{"status": "enabled", "list_id": listID}, http.StatusOK)
}

func (h *ListToggleHandler) Disable(w http.ResponseWriter, r *http.Request) {
	listID := PathParam(r, "listId")
	tenant, err := h.loadTenant(r)
	if err != nil || tenant == nil {
		Error(w, "TENANT_ERROR", "cannot load tenant", http.StatusBadRequest)
		return
	}

	filtered := make([]domain.ListConfig, 0, len(tenant.Config.EnabledLists))
	for _, lc := range tenant.Config.EnabledLists {
		if lc.ListID != listID {
			filtered = append(filtered, lc)
		}
	}
	tenant.Config.EnabledLists = filtered
	if err := h.tenants.Update(*tenant); err != nil {
		Error(w, "DB_ERROR", "failed to disable list", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]string{"status": "disabled", "list_id": listID}, http.StatusOK)
}

func (h *ListToggleHandler) loadTenant(r *http.Request) (*domain.Tenant, error) {
	tid, err := domain.NewTenantID(GetTenantID(r))
	if err != nil {
		return nil, err
	}
	return h.tenants.GetByID(tid)
}
