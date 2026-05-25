package http

import (
	"net/http"
	"os"
	"strings"
)

// NewHostAwareMux builds a mux that branches on the request Host
// header. Two flow modes:
//
//   1. Direct sdlc.cc customers: Host == sdlc.cc public domain
//      (e.g. api.sdlc.cc). Use the standard /v1/messages handler;
//      auth via JWT or X-API-Key.
//   2. Transparent-proxy customers: Host is one of the
//      TRANSPARENT_PROXY_HOSTS (e.g. api.anthropic.com on the
//      bank's network where DNS hijack is configured). Route to
//      HandleAnthropicHostMux which applies DLP for /v1/messages
//      and pass-through forwards everything else.
//
// Modes coexist on the same binary so a single deploy serves both
// SaaS B2B customers and on-prem-DNS-hijack customers.
func NewHostAwareMux(direct *http.ServeMux, anthropicHandler http.Handler) http.Handler {
	hijackHosts := parseHosts(os.Getenv("TRANSPARENT_PROXY_HOSTS"))
	if len(hijackHosts) == 0 {
		// No transparent-proxy mode configured; behave as direct
		// SaaS only. Calls to api.anthropic.com simply won't reach
		// us because corp DNS hasn't been configured.
		return direct
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := stripPort(r.Host)
		if hijackHosts[host] {
			anthropicHandler.ServeHTTP(w, r)
			return
		}
		direct.ServeHTTP(w, r)
	})
}

// parseHosts reads a comma-separated env var into a lookup set.
// Lowercased for case-insensitive matching since DNS is
// case-insensitive.
func parseHosts(env string) map[string]bool {
	m := map[string]bool{}
	for _, h := range strings.Split(env, ",") {
		h = strings.TrimSpace(strings.ToLower(h))
		if h != "" {
			m[h] = true
		}
	}
	return m
}

// stripPort removes :port suffix from Host header so DNS-style
// matching works (the corp setup may use 443 or 8443 transparently).
func stripPort(host string) string {
	if i := strings.LastIndex(host, ":"); i > 0 {
		return strings.ToLower(host[:i])
	}
	return strings.ToLower(host)
}
