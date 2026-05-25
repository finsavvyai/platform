package api

import (
	"net/http"
)

func setupExportRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	exportHandler := NewExportResultsHandler(deps.Screenings)

	mux.Handle("GET /api/v1/export/screenings",
		authChain(http.HandlerFunc(exportHandler.ExportScreenings)))
}
