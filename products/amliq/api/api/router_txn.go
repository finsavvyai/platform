package api

import "net/http"

func setupTxnRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	writeOnly := WriteAccess()

	th := NewTxnHandler(deps.Txns, deps.TxnAlerts)
	mux.Handle("POST /api/v1/transactions",
		authChain(writeOnly(http.HandlerFunc(th.Submit))))

	ah := NewTxnAlertHandler(deps.TxnAlerts)
	mux.Handle("GET /api/v1/transactions/alerts",
		authChain(http.HandlerFunc(ah.List)))
	mux.Handle("GET /api/v1/transactions/alerts/summary",
		authChain(http.HandlerFunc(ah.Summary)))

	setupTxnMonitorRoutes(mux, deps, authChain)

	rh := NewResolutionHandler(deps.Clusters)
	mux.Handle("POST /api/v1/entities/dedupe",
		authChain(http.HandlerFunc(rh.Dedupe)))
	mux.Handle("GET /api/v1/entities/clusters",
		authChain(http.HandlerFunc(rh.ListClusters)))

	mh := NewMediaScreenHandler(deps.Media)
	mux.Handle("POST /api/v1/media/batch",
		authChain(http.HandlerFunc(mh.BatchScreen)))
	mux.Handle("GET /api/v1/media/unreviewed",
		authChain(http.HandlerFunc(mh.Unreviewed)))
}
