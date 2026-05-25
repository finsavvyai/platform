package api

import "net/http"

func setupWebhookRoutes(
	mux *http.ServeMux,
	authChain func(http.Handler) http.Handler,
) {
	adminOnly := AdminOnly()
	mux.Handle("POST /api/v1/webhooks",
		authChain(adminOnly(http.HandlerFunc(handleCreateWebhook))))
	mux.Handle("GET /api/v1/webhooks",
		authChain(http.HandlerFunc(handleListWebhooks)))

	// Webhook subscription management
	mux.Handle("POST /api/v1/webhooks/subscribe",
		authChain(http.HandlerFunc(handleSubscribeWebhook)))
	mux.Handle("GET /api/v1/webhooks/subscriptions",
		authChain(http.HandlerFunc(handleListSubscriptions)))
	mux.Handle("DELETE /api/v1/webhooks/subscriptions/{id}",
		authChain(http.HandlerFunc(handleUnsubscribeWebhook)))
	mux.Handle("POST /api/v1/webhooks/test",
		authChain(http.HandlerFunc(handleTestWebhook)))
}
