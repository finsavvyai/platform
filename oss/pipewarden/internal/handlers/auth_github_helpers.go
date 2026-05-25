package handlers

import (
	"net/http"
	"os"
	"strings"
)

// githubClientID prefers the configured GitHub App client_id but falls
// back to PIPEWARDEN_GITHUB_CLIENT_ID for deploys without an App.
func (h *Handlers) githubClientID() string {
	if h.cfg != nil && h.cfg.Auth.GitHubApp.ClientID != "" {
		return h.cfg.Auth.GitHubApp.ClientID
	}
	return os.Getenv("PIPEWARDEN_GITHUB_CLIENT_ID")
}

// githubClientSecret resolves the matching secret. Same precedence as
// the client ID — App config first, env fallback.
func (h *Handlers) githubClientSecret() string {
	if h.cfg != nil && h.cfg.Auth.GitHubApp.ClientSecret != "" {
		return h.cfg.Auth.GitHubApp.ClientSecret
	}
	return os.Getenv("PIPEWARDEN_GITHUB_CLIENT_SECRET")
}

// githubRedirectURI builds the absolute callback URL the user was
// redirected through. Honors X-Forwarded-Proto + Host so production
// behind Cloudflare/nginx generates the right https:// URL even though
// the Go listener sees plain HTTP.
func (h *Handlers) githubRedirectURI(r *http.Request) string {
	scheme := "http"
	if isHTTPSReq(r) {
		scheme = "https"
	}
	host := r.Host
	if h.cfg != nil && h.cfg.Server.PublicURL != "" {
		// Strip scheme from configured public URL — we always rebuild it.
		host = strings.TrimPrefix(strings.TrimPrefix(h.cfg.Server.PublicURL, "https://"), "http://")
		scheme = "https"
	}
	return scheme + "://" + host + "/api/v1/auth/github/callback"
}

// isHTTPSReq is a copy of auth.isHTTPS — kept package-local to avoid
// cyclic imports between handlers ↔ auth.
func isHTTPSReq(r *http.Request) bool {
	if r == nil {
		return false
	}
	if r.TLS != nil {
		return true
	}
	return r.Header.Get("X-Forwarded-Proto") == "https"
}
