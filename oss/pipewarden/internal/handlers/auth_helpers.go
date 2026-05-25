package handlers

import (
	"net/http"
	"strings"
)

// publicBaseURL builds the externally-visible URL the user sees in the
// address bar. Honors cfg.Server.PublicURL when configured (production)
// and falls back to the request host (local dev). Always strips a
// trailing slash so callers can append paths cleanly.
func (h *Handlers) publicBaseURL(r *http.Request) string {
	if h != nil && h.cfg != nil && h.cfg.Server.PublicURL != "" {
		return strings.TrimRight(h.cfg.Server.PublicURL, "/")
	}
	scheme := "http"
	if isHTTPSReq(r) {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}
