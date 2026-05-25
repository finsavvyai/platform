package http

import (
	"io"
	"net/http"
	"strings"

	"github.com/finsavvyai/sdlc-core/ai"
)

// HandleAnthropicHostMux is the dispatcher that catches requests
// arriving with `Host: api.anthropic.com` (or any equivalent host
// configured in TRANSPARENT_PROXY_HOSTS). Customers running
// transparent-proxy mode point their corp DNS at us; this handler
// figures out which path the client wanted and either:
//
//   - routes to a sdlc.cc-native handler (DLP-applied), or
//   - forwards-proxies to the real upstream when we don't intercept.
//
// The DLP-relevant paths (intercepted):
//   POST /v1/messages         — full DLP + audit pipeline
//   POST /v1/messages/...     — same
//
// Pass-through paths (we don't have value-add to inject):
//   GET  /v1/models           — provider model listing
//   POST /v1/messages/count_tokens — token estimator
//   anything else under /v1/  — relayed unchanged
//
// Tenant identification when there's no JWT (Cowork / Claude Code
// won't send our token): defer to network_resolver — IP CIDR maps
// to a tenant. Each tenant is created via `tenant_network_map`
// migration on first onboarding.
func HandleAnthropicHostMux(provider ai.Provider, upstream *http.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !isInterceptedPath(r) {
			ForwardToAnthropic(upstream, w, r)
			return
		}
		// Intercepted POST /v1/messages: scrub the request body
		// (catches tool_use input args, system prompt, message
		// content), forward to real Anthropic with the customer's
		// own API key, scrub the response. The provider arg is
		// retained for future use (in-binary fallback) but unused
		// in transparent-proxy mode — the customer brought their
		// own provider relationship.
		_ = provider
		ScrubAndForward(upstream, w, r)
	}
}

// isInterceptedPath reports whether this Anthropic-API path needs
// our DLP + audit pipeline applied. Default deny: anything we
// don't explicitly intercept gets transparent-forwarded so we
// don't break Cowork features we haven't audited yet.
func isInterceptedPath(r *http.Request) bool {
	if r.Method != http.MethodPost {
		return false
	}
	p := r.URL.Path
	switch {
	case p == "/v1/messages":
		return true
	// Future: /v1/agents/{id}/runs once Anthropic ships the
	// Cowork-specific agent-runs endpoint shape we've audited.
	default:
		return false
	}
}

// ForwardToAnthropic is the transparent-passthrough for requests we
// don't intercept. Strips the corp-CA-signed cert chain (already
// done by TLS termination at this point), copies headers + body,
// hits real api.anthropic.com via the gateway's outbound egress,
// streams the response back unchanged.
func ForwardToAnthropic(client *http.Client, w http.ResponseWriter, r *http.Request) {
	upstreamURL := "https://api.anthropic.com" + r.URL.RequestURI()
	out, err := http.NewRequestWithContext(r.Context(),
		r.Method, upstreamURL, r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	for k, vs := range r.Header {
		// Skip hop-by-hop headers; Authorization passes through so
		// the upstream sees the customer's real Anthropic key.
		if isHopByHop(k) {
			continue
		}
		for _, v := range vs {
			out.Header.Add(k, v)
		}
	}
	resp, err := client.Do(out)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	for k, vs := range resp.Header {
		if isHopByHop(k) {
			continue
		}
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// isHopByHop matches the RFC 7230 §6.1 hop-by-hop header set; these
// must not be forwarded between proxies. Lowercased for case-
// insensitive matching since http.Header keys are canonical-cased.
func isHopByHop(h string) bool {
	switch strings.ToLower(h) {
	case "connection", "keep-alive", "proxy-authenticate",
		"proxy-authorization", "te", "trailers",
		"transfer-encoding", "upgrade", "host":
		return true
	}
	return false
}
