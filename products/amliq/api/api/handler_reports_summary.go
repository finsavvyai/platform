package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (h *ReportHandler) buildSummary(
	r *http.Request, tid domain.TenantID,
) domain.ReportSummary {
	ctx := r.Context()
	counts, _ := h.cases.CountByStatus(ctx, tid)
	opened := 0
	resolved := 0
	for status, count := range counts {
		if status == "open" || status == "in_review" {
			opened += count
		}
		if status == "resolved" || status == "true_match" {
			resolved += count
		}
	}
	return domain.ReportSummary{
		CasesOpened:   opened,
		CasesResolved: resolved,
	}
}

// ListReports returns previously generated reports (stub).
func (h *ReportHandler) ListReports(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	Success(w, map[string]interface{}{
		"reports": []interface{}{},
	}, http.StatusOK)
}
