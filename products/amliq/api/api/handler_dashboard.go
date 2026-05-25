package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// DashboardHandler provides compliance metrics for the dashboard.
type DashboardHandler struct {
	cases    storage.CaseQueryRepository
	monitors storage.MonitorRepository
	media    storage.AdverseMediaRepository
	txnAlert storage.TxnAlertRepository
}

// NewDashboardHandler creates the handler with required repos.
func NewDashboardHandler(
	c storage.CaseQueryRepository, m storage.MonitorRepository,
	med storage.AdverseMediaRepository, ta storage.TxnAlertRepository,
) *DashboardHandler {
	return &DashboardHandler{
		cases: c, monitors: m, media: med, txnAlert: ta,
	}
}

// ComplianceStats returns aggregate compliance metrics.
func (h *DashboardHandler) ComplianceStats(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	ctx := r.Context()

	counts, _ := h.cases.CountByStatus(ctx, tid)
	openCases := counts["open"] + counts["in_review"]

	monitors, _ := h.monitors.ListByTenant(ctx, tid)
	activeMonitors := 0
	for _, m := range monitors {
		if m.Status == domain.MonitorActive {
			activeMonitors++
		}
	}

	txnCounts, _ := h.txnAlert.CountByType(ctx, tid)
	totalTxn := 0
	for _, c := range txnCounts {
		totalTxn += c
	}

	Success(w, map[string]interface{}{
		"openCases":        openCases,
		"activeMonitors":   activeMonitors,
		"highRiskEntities": 0,
		"pendingEDD":       0,
		"unreviewedMedia":  0,
		"txnAlerts":        totalTxn,
	}, http.StatusOK)
}
