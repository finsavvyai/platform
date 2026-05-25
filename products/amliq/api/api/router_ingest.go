package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/automation"
)

// SetupIngestAndAutomationRoutes wires CSV import, webhook secret,
// and automation rule endpoints. Call from SetupRoutes.
func SetupIngestAndAutomationRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
	secretStore *WebhookSecretStore,
	automationStore automation.Store,
) {
	// CSV customer import
	importHandler := NewCustomerImportHandler(deps)
	mux.Handle("POST /api/v1/ingest/customers/import",
		authChain(http.HandlerFunc(importHandler.Import)))

	// Webhook signing secret management
	secretHandler := NewWebhookSecretHandler(secretStore)
	mux.Handle("GET /api/v1/webhooks/incoming/secret",
		authChain(http.HandlerFunc(secretHandler.Get)))
	mux.Handle("POST /api/v1/webhooks/incoming/secret/rotate",
		authChain(http.HandlerFunc(secretHandler.Rotate)))

	// Automation rules
	autoHandler := NewAutomationHandler(automationStore)
	mux.Handle("GET /api/v1/automation/rules",
		authChain(http.HandlerFunc(autoHandler.List)))
	mux.Handle("POST /api/v1/automation/rules",
		authChain(http.HandlerFunc(autoHandler.Create)))
	mux.Handle("PUT /api/v1/automation/rules/{id}",
		authChain(http.HandlerFunc(autoHandler.Update)))
	mux.Handle("DELETE /api/v1/automation/rules/{id}",
		authChain(http.HandlerFunc(autoHandler.Delete)))

	// Twilio Verify (WhatsApp / SMS / email OTP)
	verifyHandler := NewVerifyHandler()
	mux.HandleFunc("POST /api/v1/verify/send", verifyHandler.Send)
	mux.HandleFunc("POST /api/v1/verify/check", verifyHandler.Check)

	// Ad-hoc alert sending (email / SMS / WhatsApp)
	alertSend := NewAlertSendHandler()
	mux.Handle("POST /api/v1/alerts/send",
		authChain(http.HandlerFunc(alertSend.Send)))
}
