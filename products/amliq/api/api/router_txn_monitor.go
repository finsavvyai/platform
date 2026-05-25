package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/screening"
)

func setupTxnMonitorRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	analyzer := screening.NewDefaultTxnAnalyzer()
	mh := NewTxnMonitorHandler(deps.Txns, deps.TxnAlerts, analyzer)
	writeOnly := WriteAccess()

	mux.Handle("POST /api/v1/txn/analyze",
		authChain(http.HandlerFunc(mh.AnalyzeTxns)))
	mux.Handle("GET /api/v1/txn/alerts",
		authChain(http.HandlerFunc(NewTxnAlertHandler(deps.TxnAlerts).List)))
	mux.Handle("PUT /api/v1/txn/alerts/{id}/review",
		authChain(writeOnly(http.HandlerFunc(mh.ReviewAlert))))
	mux.Handle("GET /api/v1/txn/patterns",
		authChain(http.HandlerFunc(mh.ListPatterns)))

	// Orchestrated transaction screening: screen → hold → case
	tsh := NewTxnScreenHandler(
		deps.Entities, deps.Cases, deps.Alerts,
		deps.Audit, deps.Engine,
	)
	usageCheck := UsageEnforcementMiddleware(deps.Enforcer)
	mux.Handle("POST /api/v1/txn/screen",
		authChain(usageCheck(http.HandlerFunc(tsh.Screen))))
}
