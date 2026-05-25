package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type ConfigHandler struct {
	tenants storage.TenantRepository
	audit   storage.AuditRepository
}

func NewConfigHandler(
	tenants storage.TenantRepository,
	audit storage.AuditRepository,
) *ConfigHandler {
	return &ConfigHandler{
		tenants: tenants,
		audit:   audit,
	}
}

func (ch *ConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := GetTenantID(r)
	if tenantIDStr == "" {
		Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
		return
	}

	tenantID, err := domain.NewTenantID(tenantIDStr)
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	tenant, err := ch.tenants.GetByID(tenantID)
	if err != nil {
		Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
		return
	}
	if tenant == nil {
		Error(w, "NOT_FOUND", "tenant not found", http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"country":              tenant.Config.Country,
		"regulation_framework": tenant.Config.RegulationFramework,
		"default_threshold":    tenant.Config.DefaultThreshold,
		"auto_dismiss_below":   tenant.Config.AutoDismissBelow,
		"auto_escalate_above":  tenant.Config.AutoEscalateAbove,
		"screening_mode":       tenant.Config.ScreeningMode.String(),
		"batch_schedule":       tenant.Config.BatchSchedule,
		"max_batch_size":       tenant.Config.MaxBatchSize,
		"match_weights":        tenant.Config.MatchWeights,
		"enabled_lists":        tenant.Config.EnabledLists,
	}
	Success(w, response, http.StatusOK)
}
