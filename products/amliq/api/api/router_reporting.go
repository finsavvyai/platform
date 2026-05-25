package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/reporting"
)

func setupSARRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	var gen *reporting.SARGenerator
	if deps.SARGenerator != nil {
		gen = deps.SARGenerator
	} else {
		gen = reporting.NewSARGenerator(nil)
	}
	rh := NewSARReportingHandler(
		deps.SARs, deps.CaseQueries,
		deps.Screenings, deps.Alerts, gen,
	)
	writeOnly := WriteAccess()

	mux.Handle("POST /api/v1/reports/sar",
		authChain(http.HandlerFunc(rh.GenerateSAR)))
	mux.Handle("GET /api/v1/reports/sar",
		authChain(http.HandlerFunc(rh.ListSARs)))
	mux.Handle("PUT /api/v1/reports/sar/{id}",
		authChain(writeOnly(http.HandlerFunc(rh.UpdateSAR))))
	mux.Handle("GET /api/v1/reports/monthly",
		authChain(http.HandlerFunc(rh.MonthlyReport)))
	mux.Handle("GET /api/v1/reports/dashboard",
		authChain(http.HandlerFunc(rh.DashboardStats)))
}
