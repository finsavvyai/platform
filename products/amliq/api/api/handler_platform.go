package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

// PlatformHandler provides system-wide platform admin endpoints.
type PlatformHandler struct {
	tenants    storage.TenantRepository
	screenings storage.ScreeningRepository
	seats      storage.SeatRepository
	usage      storage.UsageRepository
}

func NewPlatformHandler(
	t storage.TenantRepository,
	s storage.ScreeningRepository,
	seats storage.SeatRepository,
	u storage.UsageRepository,
) *PlatformHandler {
	return &PlatformHandler{
		tenants: t, screenings: s, seats: seats, usage: u,
	}
}

// Overview returns system-wide stats for the platform admin.
func (h *PlatformHandler) Overview(w http.ResponseWriter, r *http.Request) {
	tenants, err := h.tenants.List()
	if err != nil {
		Error(w, "DB_ERROR", "list tenants failed", http.StatusInternalServerError)
		return
	}
	totalScreenings := 0
	for _, t := range tenants {
		s, _ := h.screenings.ListByTenant(t.ID)
		totalScreenings += len(s)
	}
	Success(w, map[string]interface{}{
		"total_tenants":    len(tenants),
		"total_screenings": totalScreenings,
	}, http.StatusOK)
}
