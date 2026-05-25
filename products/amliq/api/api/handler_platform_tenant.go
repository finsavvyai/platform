package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// PlatformTenantHandler provides suspend/activate for tenants.
type PlatformTenantHandler struct {
	tenants storage.TenantRepository
	audit   storage.AuditRepository
}

func NewPlatformTenantHandler(
	t storage.TenantRepository, a storage.AuditRepository,
) *PlatformTenantHandler {
	return &PlatformTenantHandler{tenants: t, audit: a}
}

// SuspendTenant disables a tenant's access.
func (h *PlatformTenantHandler) SuspendTenant(w http.ResponseWriter, r *http.Request) {
	idStr := PathParam(r, "id")
	tid, err := domain.NewTenantID(idStr)
	if err != nil {
		Error(w, "INVALID_ID", err.Error(), http.StatusBadRequest)
		return
	}
	tenant, err := h.tenants.GetByID(tid)
	if err != nil || tenant == nil {
		Error(w, "NOT_FOUND", "tenant not found", http.StatusNotFound)
		return
	}
	tenant.Suspended = true
	if err := h.tenants.Update(*tenant); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"id": tid.String(), "suspended": true,
	}, http.StatusOK)
}

// ActivateTenant re-enables a suspended tenant.
func (h *PlatformTenantHandler) ActivateTenant(w http.ResponseWriter, r *http.Request) {
	idStr := PathParam(r, "id")
	tid, err := domain.NewTenantID(idStr)
	if err != nil {
		Error(w, "INVALID_ID", err.Error(), http.StatusBadRequest)
		return
	}
	tenant, err := h.tenants.GetByID(tid)
	if err != nil || tenant == nil {
		Error(w, "NOT_FOUND", "tenant not found", http.StatusNotFound)
		return
	}
	tenant.Suspended = false
	if err := h.tenants.Update(*tenant); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"id": tid.String(), "suspended": false,
	}, http.StatusOK)
}
