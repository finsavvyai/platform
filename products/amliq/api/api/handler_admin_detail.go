package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// AdminDetailHandler shows individual tenant detail.
type AdminDetailHandler struct {
	tenants    storage.TenantRepository
	screenings storage.ScreeningRepository
}

func NewAdminDetailHandler(
	t storage.TenantRepository, s storage.ScreeningRepository,
) *AdminDetailHandler {
	return &AdminDetailHandler{tenants: t, screenings: s}
}

func (h *AdminDetailHandler) GetTenant(w http.ResponseWriter, r *http.Request) {
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
	screenings, _ := h.screenings.ListByTenant(tid)
	Success(w, map[string]interface{}{
		"tenant":            tenant,
		"screening_count":   len(screenings),
		"recent_screenings": truncateScreenings(screenings, 10),
	}, http.StatusOK)
}

func truncateScreenings(s []domain.ScreenResponse, max int) []domain.ScreenResponse {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
