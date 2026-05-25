package api

import (
	"log"

	"github.com/aegis-aml/aegis/internal/email"
)

// sendWelcomeAsync dispatches the welcome email in a goroutine so
// signup latency stays bounded by repo writes only. Errors are
// logged and intentionally not surfaced — a slow Resend response
// must not break account creation. Callers pass a nil sender when
// no provider is configured (dev / no-DB) and the helper no-ops.
func (h *AuthHandler) sendWelcomeAsync(toEmail, orgName string) {
	if h.emailSender == nil {
		return
	}
	go func(s email.Sender, to, org string) {
		ctx := email.DefaultWelcome(org)
		if err := email.SendWelcome(s, to, ctx); err != nil {
			log.Printf("welcome mail to %s: %v", to, err)
		}
	}(h.emailSender, toEmail, orgName)
}
