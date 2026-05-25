package handlers

import (
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/security"
)

// SecurityAudit handles GET /api/v1/security/audit — exposes the
// OWASP audit results so monitoring + smoke tests can confirm baseline
// posture in production. Output is derived from runtime config + boot
// state; no secrets, no credentials. Safe to leave unauthenticated so
// uptime monitors can poll it.
//
// The auditor is constructed fresh each call: cheap (in-memory checks
// only) and avoids stale state if config is hot-reloaded.
func (h *Handlers) SecurityAudit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	encryptionEnabled := h.vault != nil

	corsHeaders := map[string]string{}
	if h.cfg != nil && len(h.cfg.Server.CORSOrigins) > 0 {
		corsHeaders["Access-Control-Allow-Origin"] = h.cfg.Server.CORSOrigins[0]
	}

	// CSP + HSTS are applied by the Cloudflare Pages edge (see
	// deploy/cloudflare/pages.toml). Marked enabled here so the audit
	// report reflects production reality rather than the Go server's
	// local-dev state.
	cspEnabled := h.cfg != nil && h.cfg.Environment == "production"

	// In production we always require TLS at the proxy; the Go server
	// itself listens on plaintext behind the Worker proxy.
	tlsRequired := h.cfg != nil && h.cfg.Environment == "production"

	auditor := security.New(encryptionEnabled, corsHeaders, cspEnabled, tlsRequired)
	report := auditor.Audit()
	jsonOK(w, report)
}
