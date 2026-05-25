package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// ReportHandler generates compliance reports for regulators.
type ReportHandler struct {
	screenings storage.ScreeningRepository
	alerts     storage.AlertRepository
	cases      storage.CaseQueryRepository
}

// NewReportHandler creates the handler.
func NewReportHandler(
	s storage.ScreeningRepository, a storage.AlertRepository,
	c storage.CaseQueryRepository,
) *ReportHandler {
	return &ReportHandler{screenings: s, alerts: a, cases: c}
}

// Generate builds a compliance summary for the requested period.
func (h *ReportHandler) Generate(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	from, to := parsePeriod(r)
	summary := h.buildSummary(r, tid)
	rpt, err := domain.NewComplianceReport(
		tid, domain.ReportAudit, from, to, summary,
	)
	if err != nil {
		Error(w, "INVALID", err.Error(), http.StatusBadRequest)
		return
	}
	Success(w, map[string]interface{}{"report": rpt}, http.StatusOK)
}

func parsePeriod(r *http.Request) (time.Time, time.Time) {
	from, _ := time.Parse("2006-01-02", QueryParam(r, "from"))
	to, _ := time.Parse("2006-01-02", QueryParam(r, "to"))
	if from.IsZero() {
		from = time.Now().AddDate(0, -1, 0)
	}
	if to.IsZero() {
		to = time.Now()
	}
	return from, to
}
