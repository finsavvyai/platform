package api

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type ExportResultsHandler struct {
	screenings storage.ScreeningRepository
}

func NewExportResultsHandler(screenings storage.ScreeningRepository) *ExportResultsHandler {
	return &ExportResultsHandler{screenings: screenings}
}

func (eh *ExportResultsHandler) ExportScreenings(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}

	from := QueryParam(r, "from")
	to := QueryParam(r, "to")
	format := QueryParam(r, "format")
	if format == "" {
		format = "csv"
	}

	fromTime := parseTime(from, time.Now().AddDate(0, 0, -7))
	toTime := parseTime(to, time.Now())

	tid, err := domain.NewTenantID(tenantID)
	if err != nil {
		Error(w, "INVALID_TENANT", "invalid tenant id", http.StatusBadRequest)
		return
	}

	screenings, err := eh.screenings.ListByTenant(tid)
	if err != nil {
		Error(w, "DB_ERROR", "failed to query", http.StatusInternalServerError)
		return
	}

	filtered := filterByDateRange(screenings, fromTime, toTime)

	if format == "json" {
		eh.resultsJSON(w, filtered)
	} else {
		eh.resultsCSV(w, filtered)
	}
}

func (eh *ExportResultsHandler) resultsCSV(w http.ResponseWriter,
	screenings []domain.ScreenResponse) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition",
		"attachment; filename=screening_results.csv")
	cw := csv.NewWriter(w)
	defer cw.Flush()

	headers := []string{
		"screening_id", "query_name", "match_name",
		"confidence", "list_source", "timestamp", "disposition",
	}
	cw.Write(headers)

	for _, sr := range screenings {
		for _, match := range sr.Matches {
			cw.Write([]string{
				sr.ID,
				sr.Request.Entity.PrimaryName().Full,
				match.EntityID.String(),
				strconv.FormatFloat(match.Confidence.Score(), 'f', 2, 64),
				match.ListID,
				match.TimestampHit.Format(time.RFC3339),
				match.Disposition.String(),
			})
		}
	}
}

func (eh *ExportResultsHandler) resultsJSON(w http.ResponseWriter,
	screenings []domain.ScreenResponse) {
	w.Header().Set("Content-Type", "application/json")
	Success(w, screenings, http.StatusOK)
}
