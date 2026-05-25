package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/finsavvyai/sdlc-core/ai"
	"github.com/finsavvyai/sdlc-core/audit"
	"github.com/finsavvyai/sdlc-core/dlp"
	"github.com/finsavvyai/sdlc-core/quota"

	"github.com/finsavvyai/sdlc-cc/internal/metrics"
)

// MetricsRecorder is the surface HandleMessages needs from metrics.
// Decoupled so tests + alternative metrics backends don't have to
// pull in the concrete Registry type.
type MetricsRecorder interface {
	IncRequestOK()
	IncRequestError()
	IncRequestQuotaExceeded()
	ObserveLatencyMicros(usec int64)
	AddDLPRedactions(n int)
}

// noopMetrics lets the handler treat nil-registry callers without
// per-call branching on every counter increment.
type noopMetrics struct{}

func (noopMetrics) IncRequestOK()                {}
func (noopMetrics) IncRequestError()             {}
func (noopMetrics) IncRequestQuotaExceeded()     {}
func (noopMetrics) ObserveLatencyMicros(int64)   {}
func (noopMetrics) AddDLPRedactions(int)         {}

func resolveMetrics(reg *metrics.Registry) MetricsRecorder {
	if reg == nil {
		return noopMetrics{}
	}
	return reg
}

// HandleMessages serves POST /v1/messages — the Anthropic-compat
// drop-in. Pipeline: parse → DLP scrub each message → forward to
// Provider chain → DLP scrub response → emit Anthropic-shape JSON.
//
// Streaming (req.Stream=true) is handled by HandleMessagesStream
// (see sse.go); we route there before doing the non-stream work.
//
// Audit: when repo is non-nil, every successful + failed request is
// recorded so /v1/audit/usage can aggregate by tenant/provider/cost.
// Tenant ID comes from the request context (transparent-proxy mode
// resolved it via tenant_network_map); empty string is fine and just
// flows through as "unattributed".
//
// Quota: when enforcer is non-nil, gates the call against per-tenant
// + per-seat 24h sliding-window caps. Over cap → 429 + audit row
// classified as QUOTA_EXCEEDED. Counter is bumped after a successful
// provider response only — failed calls don't burn quota.
//
// Metrics: when reg is non-nil, increments request counters (ok /
// error / quota_exceeded) and observes provider latency. nil-safe via
// the noopMetrics fallback so tests + dev binaries skip wiring.
func HandleMessages(provider ai.Provider, repo audit.Repository, enforcer *quota.AIQuotaEnforcer, reg *metrics.Registry) http.HandlerFunc {
	m := resolveMetrics(reg)
	return func(w http.ResponseWriter, r *http.Request) {
		var req MessagesRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeErr(w, "BAD_REQUEST", "invalid body", http.StatusBadRequest)
			return
		}
		if req.Stream {
			// Body is already consumed; pass the parsed request
			// straight to the streaming inner helper so we don't
			// re-decode an empty body.
			streamWithRequest(provider, req, w, r)
			return
		}
		prompt, err := buildPrompt(req)
		if err != nil {
			writeErr(w, "BAD_REQUEST", err.Error(), http.StatusBadRequest)
			return
		}
		if !provider.IsConfigured() {
			writeErr(w, "AI_UNAVAILABLE",
				"no provider configured",
				http.StatusServiceUnavailable)
			return
		}

		tenantID := TenantIDFromContext(r.Context())

		// Pre-call quota gate. Empty actor (we don't issue per-seat
		// JWTs at sdlc.cc) → only the tenant cap fires. Audit the
		// rejection so operators see runaway tenants.
		if enforcer != nil && !enforcer.Allow(tenantID, "") {
			audit.RecordAIRequest(repo, audit.BuildErrorLog(
				tenantID, "", "quota", defaultModel(req.Model),
				"messages", prompt, "QUOTA_EXCEEDED", 0))
			m.IncRequestQuotaExceeded()
			writeErr(w, "QUOTA_EXCEEDED",
				"daily AI quota exceeded for this tenant",
				http.StatusTooManyRequests)
			return
		}

		started := time.Now()

		text, err := provider.Complete(r.Context(), prompt)
		latency := time.Since(started)
		usedProvider := providerName(provider)

		if err != nil {
			audit.RecordAIRequest(repo, audit.BuildErrorLog(
				tenantID, "", usedProvider, defaultModel(req.Model),
				"messages", prompt, audit.ClassifyError(err), latency))
			m.IncRequestError()
			m.ObserveLatencyMicros(latency.Microseconds())
			writeErr(w, "AI_ERROR", "completion failed",
				http.StatusBadGateway)
			return
		}
		scrubbed := dlp.MaskAML(text)

		audit.RecordAIRequest(repo, audit.BuildSuccessLog(
			tenantID, "", usedProvider, defaultModel(req.Model),
			"messages", prompt, scrubbed, latency, false))
		if enforcer != nil {
			enforcer.Record(tenantID, "")
		}
		m.IncRequestOK()
		m.ObserveLatencyMicros(latency.Microseconds())

		resp := MessagesResponse{
			ID:    fmt.Sprintf("msg_sdlc_%d", time.Now().UnixNano()),
			Type:  "message", Role: "assistant",
			Model: defaultModel(req.Model),
			Content: []ContentBlock{
				{Type: "text", Text: scrubbed},
			},
			StopReason: "end_turn",
			Usage: Usage{
				InputTokens:  estTokens(prompt),
				OutputTokens: estTokens(scrubbed),
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// providerName extracts the actually-used provider from a chain. For
// a single Provider this is just Name(); for a FallbackChain it's
// LastUsed() so the audit row credits the link that actually ran,
// not the chain's symbolic name.
func providerName(p ai.Provider) string {
	if chain, ok := p.(*ai.FallbackChain); ok {
		if last := chain.LastUsed(); last != "" {
			return last
		}
	}
	return p.Name()
}
