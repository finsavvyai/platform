// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Mount POST /v1/redact for the privacy-gateway browser extension,
// IDE addins, and Office addins. Delegates to DLP.Scan so the
// standalone endpoint cannot drift from the inbound middleware's
// per-tenant policy + custom patterns + legal preset.

package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/redact"
)

// mountRedact wires POST /v1/redact. When the DLP is not configured
// (dev / no security suite), the handler 503s with a clear message
// so the surface stays discoverable.
func mountRedact(r chi.Router, app *Application) {
	dlp := dlpFromSuite(app.Security)
	scanner := redact.FromDLP(dlp)
	tenantFrom := func(req *http.Request) string {
		if id, ok := tenantCtxFromChain(req.Context()); ok && id != uuid.Nil {
			return id.String()
		}
		return ""
	}
	r.Method(http.MethodPost, "/v1/redact", redact.Handler(scanner, tenantFrom))
}
