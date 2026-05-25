package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

// AdminHandler provides admin-only tenant management endpoints.
type AdminHandler struct {
	tenants    storage.TenantRepository
	screenings storage.ScreeningRepository
	usage      storage.UsageRepository
}

func NewAdminHandler(
	t storage.TenantRepository,
	s storage.ScreeningRepository,
	u storage.UsageRepository,
) *AdminHandler {
	return &AdminHandler{tenants: t, screenings: s, usage: u}
}

// ListTenants returns all tenants with summary data.
func (ah *AdminHandler) ListTenants(w http.ResponseWriter, r *http.Request) {
	tenants, err := ah.tenants.List()
	if err != nil {
		Error(w, "DB_ERROR", "failed to list tenants",
			http.StatusInternalServerError)
		return
	}
	summaries := make([]map[string]interface{}, 0, len(tenants))
	for _, t := range tenants {
		summaries = append(summaries, map[string]interface{}{
			"id":           t.ID.String(),
			"name":         t.Name,
			"display_name": t.DisplayName,
			"created_at":   t.CreatedAt,
		})
	}
	Success(w, map[string]interface{}{
		"tenants": summaries,
		"total":   len(summaries),
	}, http.StatusOK)
}
