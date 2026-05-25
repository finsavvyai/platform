package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// AnalyticsHandler serves tenant-scoped dashboard + metrics endpoints.
type AnalyticsHandler struct {
	screenings storage.ScreeningRepository
	alerts     storage.AlertRepository
}

// NewAnalyticsHandler wires the analytics handler with its deps.
func NewAnalyticsHandler(
	screenings storage.ScreeningRepository,
	alerts storage.AlertRepository,
) *AnalyticsHandler {
	return &AnalyticsHandler{
		screenings: screenings,
		alerts:     alerts,
	}
}

// Dashboard returns aggregated screening + alert metrics for the
// authenticated tenant.
func (ah *AnalyticsHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
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

	screenings, _ := ah.screenings.ListByTenant(tenantID)
	alerts, _ := ah.alerts.ListByTenant(tenantID)

	pending, escalated, resolved := countAlertStatuses(alerts)
	response := map[string]interface{}{
		"screenings_total":     len(screenings),
		"totalAlerts":          len(alerts),
		"pendingAlerts":        pending,
		"clearedAlerts":        resolved,
		"escalatedAlerts":      escalated,
		"avgResolutionTime":    0,
		"screeningVolume":      buildScreeningVolume(screenings),
		"dispositionBreakdown": buildDisposition(alerts),
		"riskDistribution":     buildRiskDist(screenings),
		"topEntities":          buildTopEntities(screenings),
	}
	Success(w, response, http.StatusOK)
}

// Metrics returns placeholder aggregate metrics (volumes, match
// rates, disposition rates). Populated once the time-series
// warehouse ships — today the handler returns zeros so the
// dashboard renders without a 404.
func (ah *AnalyticsHandler) Metrics(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"screening_volume": map[string]interface{}{
			"total": 0, "today": 0,
		},
		"match_rates": map[string]interface{}{
			"exact": 0.0, "fuzzy": 0.0,
			"phonetic": 0.0, "token": 0.0,
		},
		"disposition_rates": map[string]interface{}{
			"AutoClear": 0.0, "Review": 0.0, "AutoEscalate": 0.0,
		},
	}
	Success(w, response, http.StatusOK)
}

func countAlertStatuses(alerts []domain.Alert) (pending, escalated, resolved int) {
	for _, a := range alerts {
		switch a.Status {
		case domain.AlertStatusPending:
			pending++
		case domain.AlertStatusEscalated:
			escalated++
		case domain.AlertStatusResolved:
			resolved++
		}
	}
	return
}
