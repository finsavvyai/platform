package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// MonthlyReport generates monthly compliance stats.
func (h *SARReportingHandler) MonthlyReport(
	w http.ResponseWriter, r *http.Request,
) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	year, _ := strconv.Atoi(QueryParam(r, "year"))
	month, _ := strconv.Atoi(QueryParam(r, "month"))
	if year == 0 {
		year = time.Now().Year()
	}
	if month == 0 {
		month = int(time.Now().Month()) - 1
	}
	metrics := h.collectMetrics(r, tid)
	Success(w, map[string]interface{}{
		"tenant_id": tenantID,
		"month":     time.Month(month).String(),
		"year":      year,
		"metrics":   metrics,
	}, http.StatusOK)
}

// DashboardStats returns reporting dashboard summary.
func (h *SARReportingHandler) DashboardStats(
	w http.ResponseWriter, r *http.Request,
) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	Success(w, h.collectMetrics(r, tid), http.StatusOK)
}

func (h *SARReportingHandler) collectMetrics(
	r *http.Request, tid domain.TenantID,
) map[string]interface{} {
	ctx := r.Context()
	screenings, _ := h.screenings.ListByTenant(tid)
	alerts, _ := h.alerts.ListByTenant(tid)
	caseCounts, _ := h.cases.CountByStatus(ctx, tid)
	sarCount, _ := h.sars.CountByTenant(ctx, tid)
	opened, closed, dismissed := aggregateCases(caseCounts)
	totalAlerts := len(alerts)
	fpRate := 0.0
	if totalAlerts > 0 {
		fpRate = float64(dismissed) / float64(totalAlerts)
	}
	return map[string]interface{}{
		"screenings_performed": len(screenings),
		"alerts_generated":     totalAlerts,
		"cases_opened":         opened,
		"cases_closed":         closed,
		"sars_filed":           sarCount,
		"false_positive_rate":  fpRate,
	}
}

func aggregateCases(counts map[string]int) (opened, closed, dismissed int) {
	for status, count := range counts {
		switch domain.CaseStatus(status) {
		case domain.CaseOpen, domain.CaseInReview, domain.CaseEscalated:
			opened += count
		case domain.CaseResolved, domain.CaseTrueMatch, domain.CaseArchived:
			closed += count
		case domain.CaseFalsePos:
			dismissed += count
		}
	}
	return
}
