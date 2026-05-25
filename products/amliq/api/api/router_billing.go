package api

import "net/http"

func setupBillingRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	mux.HandleFunc("GET /api/v1/billing/products", handleBillingPlans)
	mux.HandleFunc("GET /api/v1/billing/health", handleBillingHealth)

	if deps.BillingSvc != nil {
		mux.Handle("POST /api/v1/billing/checkout",
			authChain(http.HandlerFunc(handleCheckout(deps.BillingSvc))))
		mux.Handle("GET /api/v1/billing/subscriptions",
			authChain(http.HandlerFunc(handleBillingSubscriptions(deps.BillingSvc))))
		mux.Handle("GET /api/v1/billing/usage",
			authChain(http.HandlerFunc(handleBillingUsage(deps.BillingSvc))))
		mux.Handle("GET /api/v1/billing/invoices",
			authChain(http.HandlerFunc(handleBillingInvoices(deps.BillingSvc))))
	} else {
		mux.Handle("POST /api/v1/billing/checkout",
			authChain(http.HandlerFunc(freeTierCheckout)))
		mux.Handle("GET /api/v1/billing/subscriptions",
			authChain(http.HandlerFunc(freeTierSubscriptions)))
		mux.Handle("GET /api/v1/billing/usage",
			authChain(freeTierUsageHandler(deps.Enforcer)))
		mux.Handle("GET /api/v1/billing/invoices",
			authChain(http.HandlerFunc(freeTierInvoices)))
	}

	mux.Handle("POST /api/v1/billing/promo",
		authChain(http.HandlerFunc(handlePromoCode)))

	mux.Handle("POST /api/v1/billing/seats",
		authChain(http.HandlerFunc(handleAddSeat(deps.Seats, defaultSeatLimit))))
	mux.Handle("GET /api/v1/billing/seats",
		authChain(http.HandlerFunc(handleGetSeats(deps.Seats))))
	mux.Handle("DELETE /api/v1/billing/seats/{id}",
		authChain(http.HandlerFunc(handleDeleteSeat(deps.Seats))))

	if deps.BillingSvc != nil {
		webhookH := NewWebhookHandler(deps.BillingSvc)
		mux.HandleFunc("POST /webhooks/lemonsqueezy", webhookH.Handle)
	}
}
