package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ListSARs returns SARs filtered by status.
func (h *SARReportingHandler) ListSARs(
	w http.ResponseWriter, r *http.Request,
) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	status := QueryParam(r, "status")
	sars, err := h.sars.ListByTenantID(r.Context(), tid, status, 100)
	if err != nil {
		Error(w, "INTERNAL", "failed to list SARs", http.StatusInternalServerError)
		return
	}
	if sars == nil {
		sars = []domain.SAR{}
	}
	Success(w, map[string]interface{}{
		"sars": sars, "total": len(sars),
	}, http.StatusOK)
}

// UpdateSAR modifies a SAR's narrative or status.
func (h *SARReportingHandler) UpdateSAR(
	w http.ResponseWriter, r *http.Request,
) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	sarID := PathParam(r, "id")
	if sarID == "" {
		Error(w, "INVALID", "SAR id required", http.StatusBadRequest)
		return
	}
	existing, err := h.sars.GetByID(r.Context(), sarID)
	if err != nil || existing == nil {
		Error(w, "NOT_FOUND", "SAR not found", http.StatusNotFound)
		return
	}
	_ = tenantID // verified for auth
	var req UpdateSARRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	if req.Status != "" {
		newStatus := domain.SARFilingStatus(req.Status)
		if !existing.CanTransition(newStatus) {
			Error(w, "INVALID", "invalid status transition", http.StatusBadRequest)
			return
		}
		existing.FilingStatus = newStatus
	}
	if req.Narrative != "" {
		existing.NarrativeSummary = req.Narrative
	}
	if err := h.sars.Update(r.Context(), *existing); err != nil {
		Error(w, "INTERNAL", "update failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{"sar": existing}, http.StatusOK)
}

// UpdateSARRequest is the request body for updating a SAR.
type UpdateSARRequest struct {
	Status    string `json:"status"`
	Narrative string `json:"narrative"`
}
