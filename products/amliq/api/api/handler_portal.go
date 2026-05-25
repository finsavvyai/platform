package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

type PortalHandler struct{}

func NewPortalHandler() *PortalHandler {
	return &PortalHandler{}
}

func (h *PortalHandler) GeneratePortalURL(w http.ResponseWriter, r *http.Request) {
	tenantID, err := domain.NewTenantID(r.Header.Get("X-Tenant-ID"))
	if err != nil || tenantID.IsZero() {
		Error(w, "INVALID_TENANT", "tenant id required", http.StatusBadRequest)
		return
	}

	portalURL := "https://lemonsqueezy.com/billing"

	Success(w, map[string]string{
		"portal_url": portalURL,
		"note":       "Implement with LemonSqueezy Portal API integration",
	}, http.StatusOK)
}
