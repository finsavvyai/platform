package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (ch *ConfigHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		Error(w, "METHOD_NOT_ALLOWED", "use PUT", http.StatusMethodNotAllowed)
		return
	}

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

	var updateReq map[string]interface{}
	if err := DecodeJSON(r, &updateReq); err != nil {
		Error(w, "INVALID_REQUEST", "failed to decode", http.StatusBadRequest)
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

	if threshold, ok := updateReq["default_threshold"].(float64); ok {
		tenant.Config.DefaultThreshold = threshold
	}
	if dismissBelow, ok := updateReq["auto_dismiss_below"].(float64); ok {
		tenant.Config.AutoDismissBelow = dismissBelow
	}
	if escalateAbove, ok := updateReq["auto_escalate_above"].(float64); ok {
		tenant.Config.AutoEscalateAbove = escalateAbove
	}
	if batchSize, ok := updateReq["max_batch_size"].(float64); ok {
		tenant.Config.MaxBatchSize = int(batchSize)
	}
	if weights, ok := updateReq["match_weights"].(map[string]interface{}); ok {
		tenant.Config.MatchWeights = parseMatchWeights(weights, tenant.Config.MatchWeights)
	}

	if err := tenant.Config.Validate(); err != nil {
		Error(w, "VALIDATION_ERROR", err.Error(), http.StatusBadRequest)
		return
	}

	tenant.UpdatedAt = time.Now().UTC()
	if err := ch.tenants.Update(*tenant); err != nil {
		Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
		return
	}

	actorID := "system"
	if claims, ok := ClaimsFromContext(r.Context()); ok {
		actorID = claims.UserID
	}

	auditEntry, err := domain.NewAuditEntry(
		tenantID,
		domain.AuditActionConfigUpdated,
		actorID,
		"TenantConfig",
		tenantID.String(),
	)
	if err == nil {
		auditEntry.Details = updateReq
		_ = ch.audit.Create(auditEntry)
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
	}
	Success(w, response, http.StatusOK)
}
