package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// AdminManageHandler creates/suspends tenants and overrides config.
type AdminManageHandler struct {
	tenants storage.TenantRepository
	audit   storage.AuditRepository
}

func NewAdminManageHandler(
	t storage.TenantRepository, a storage.AuditRepository,
) *AdminManageHandler {
	return &AdminManageHandler{tenants: t, audit: a}
}

type CreateTenantRequest struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
}

func (h *AdminManageHandler) CreateTenant(w http.ResponseWriter, r *http.Request) {
	var req CreateTenantRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID_REQUEST", "bad json", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		Error(w, "VALIDATION", "name required", http.StatusBadRequest)
		return
	}
	tid, err := domain.GenerateTenantID()
	if err != nil {
		Error(w, "ID_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	tenant, err := domain.NewTenant(tid, req.Name, req.DisplayName)
	if err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.tenants.Create(tenant); err != nil {
		Error(w, "DB_ERROR", "create failed", http.StatusInternalServerError)
		return
	}
	Success(w, tenant, http.StatusCreated)
}

func (h *AdminManageHandler) UpdateTenantConfig(w http.ResponseWriter, r *http.Request) {
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
	var cfg domain.TenantConfig
	if err := DecodeJSON(r, &cfg); err != nil {
		Error(w, "INVALID_REQUEST", "bad config json", http.StatusBadRequest)
		return
	}
	tenant.Config = cfg
	if err := h.tenants.Update(*tenant); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}
	Success(w, tenant, http.StatusOK)
}
