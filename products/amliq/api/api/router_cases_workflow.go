package api

import "net/http"

func setupCaseWorkflowRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	wh := NewCaseWorkflowHandler(
		deps.Cases, deps.CaseComments, nil,
	)
	writeOnly := WriteAccess()
	mux.Handle("PUT /api/v1/cases/{id}/transition",
		authChain(writeOnly(http.HandlerFunc(wh.Transition))))
	mux.Handle("POST /api/v1/cases/{id}/evidence",
		authChain(writeOnly(http.HandlerFunc(wh.AddEvidence))))
	mux.Handle("GET /api/v1/cases/{id}/timeline",
		authChain(http.HandlerFunc(wh.Timeline)))
}
