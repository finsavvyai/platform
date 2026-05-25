package api

import (
	"fmt"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (h *SyncListHandler) extractParams(r *http.Request) (domain.TenantID, string, error) {
	tenantIDStr := GetTenantID(r)
	if tenantIDStr == "" {
		return domain.TenantID{}, "", fmt.Errorf("tenant_id required")
	}

	tenantID, err := domain.NewTenantID(tenantIDStr)
	if err != nil {
		return domain.TenantID{}, "", fmt.Errorf("invalid tenant_id: %w", err)
	}

	listID := PathParam(r, "id")
	if listID == "" {
		return domain.TenantID{}, "", fmt.Errorf("list id required")
	}

	return tenantID, listID, nil
}

func (h *SyncListHandler) findList(
	tenantID domain.TenantID,
	listID string,
) (*domain.Tenant, *domain.ListConfig, error) {
	tenant, err := h.tenants.GetByID(tenantID)
	if err != nil {
		return nil, nil, fmt.Errorf("load tenant: %w", err)
	}
	if tenant == nil {
		return nil, nil, fmt.Errorf("tenant not found")
	}

	for i := range tenant.Config.EnabledLists {
		if tenant.Config.EnabledLists[i].ListID == listID {
			return tenant, &tenant.Config.EnabledLists[i], nil
		}
	}
	return nil, nil, fmt.Errorf("list %s not found in tenant config", listID)
}
