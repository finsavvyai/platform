package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type UBOHandler struct {
	ubos storage.UBORepository
}

func NewUBOHandler(u storage.UBORepository) *UBOHandler {
	return &UBOHandler{ubos: u}
}

type AddUBORequest struct {
	OrganizationID string  `json:"organization_id"`
	OwnerName      string  `json:"owner_name"`
	Nationality    string  `json:"nationality"`
	OwnershipPct   float64 `json:"ownership_pct"`
	IsDirectOwner  bool    `json:"is_direct_owner"`
}

func (h *UBOHandler) AddOwner(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	var req AddUBORequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	owner, err := domain.NewBeneficialOwner(
		tid, req.OrganizationID, req.OwnerName,
		req.Nationality, req.OwnershipPct, req.IsDirectOwner,
	)
	if err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.ubos.Create(r.Context(), owner); err != nil {
		Error(w, "DB_ERROR", "create failed", http.StatusInternalServerError)
		return
	}
	Success(w, owner, http.StatusCreated)
}

func (h *UBOHandler) ListByOrg(w http.ResponseWriter, r *http.Request) {
	orgID := PathParam(r, "id")
	if orgID == "" {
		Error(w, "MISSING_PARAM", "org id required", http.StatusBadRequest)
		return
	}
	owners, err := h.ubos.ListByOrg(r.Context(), orgID)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	total := 0.0
	for _, o := range owners {
		total += o.OwnershipPct
	}
	Success(w, map[string]interface{}{
		"owners": owners, "total_ownership_pct": total,
	}, http.StatusOK)
}

func (h *UBOHandler) DeleteOwner(w http.ResponseWriter, r *http.Request) {
	ownerID := PathParam(r, "owner_id")
	if ownerID == "" {
		Error(w, "MISSING_PARAM", "owner id required", http.StatusBadRequest)
		return
	}
	if err := h.ubos.Delete(r.Context(), ownerID); err != nil {
		Error(w, "DB_ERROR", "delete failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]string{"deleted": ownerID}, http.StatusOK)
}
