package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type EDDHandler struct {
	edds storage.EDDRepository
}

func NewEDDHandler(e storage.EDDRepository) *EDDHandler {
	return &EDDHandler{edds: e}
}

type CreateEDDRequest struct {
	EntityID   string `json:"entity_id"`
	EntityName string `json:"entity_name"`
	CaseID     string `json:"case_id"`
}

func (h *EDDHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	var req CreateEDDRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	report, err := domain.NewEDDReport(tid, req.EntityID, req.EntityName, req.CaseID)
	if err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.edds.Create(r.Context(), report); err != nil {
		Error(w, "DB_ERROR", "create failed", http.StatusInternalServerError)
		return
	}
	Success(w, report, http.StatusCreated)
}

func (h *EDDHandler) Get(w http.ResponseWriter, r *http.Request) {
	eddID := PathParam(r, "id")
	report, err := h.edds.GetByID(r.Context(), eddID)
	if err != nil || report == nil {
		Error(w, "NOT_FOUND", "EDD report not found", http.StatusNotFound)
		return
	}
	Success(w, report, http.StatusOK)
}
