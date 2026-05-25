// Anthropic-compatible /anthropic/v1/messages endpoint. The whole
// Claude Team drop-in story relies on this surface: a customer
// changing one base URL (ANTHROPIC_BASE_URL=https://gateway.sdlc.app)
// must keep their existing Anthropic SDK working unchanged.
//
// The handler intentionally proxies the request body verbatim to
// the upstream so future Anthropic schema additions (new tools,
// new headers, new response fields) do not require a gateway
// release. DLP scanning is delegated to the existing chain
// middleware (chain.go steps 8a + 12a) so the same per-tenant
// redact|mask|block policy applies here too.
//
// Streaming (stream:true) passes through as SSE for v1; inline DLP
// on the stream is week-2 work.
package anthropic_compat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	infmw "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
	infspend "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/spend"
)

// BYOKLookup is the read interface the handler needs from
// byok.PgxRepo. Defined locally so tests can pass a fake without
// standing up Postgres.
type BYOKLookup interface {
	Get(ctx context.Context, tenantID uuid.UUID, provider string) (string, error)
}

// Deps wires the upstream key + spend tracker. APIKey is the
// platform-wide fallback credential (used when the tenant has not
// enrolled BYOK). BYOK lookup is via byok.PgxRepo (or any
// BYOKLookup) when wired, else the platform key is always used.
// Tracker is optional: nil disables spend recording.
//
// StreamDLP is the per-request factory for the inline-DLP SSE
// redactor (Claude Team A2). When it returns a non-nil redactor,
// every Anthropic text_delta event passes through the redactor
// before reaching the customer. nil falls back to byte-for-byte
// pass-through.
type Deps struct {
	APIKey    string
	BaseURL   string
	Client    *http.Client
	Tracker   *infspend.Tracker
	TenantCtx func(ctx context.Context) (uuid.UUID, bool)
	BYOK      BYOKLookup // optional; nil falls back to platform key
	StreamDLP func(ctx context.Context, w http.ResponseWriter) *infmw.StreamRedactor
}

// usageFragment captures the model + usage block from the Anthropic
// response so spend.Tracker.Record can charge the tenant.
type usageFragment struct {
	Model string `json:"model"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

// Messages returns the http.HandlerFunc to mount at
// `POST /anthropic/v1/messages`. The handler:
//   - copies the request body verbatim (after the DLP chain step)
//   - forwards x-api-key + anthropic-version + anthropic-beta
//   - copies the response body + content-type back to the caller
//   - records spend on success when a tracker is wired
//   - emits an Anthropic-shape error envelope on transport failure
func Messages(deps Deps) http.HandlerFunc {
	if deps.Client == nil {
		deps.Client = &http.Client{Timeout: 120 * time.Second}
	}
	if deps.BaseURL == "" {
		deps.BaseURL = "https://api.anthropic.com"
	}
	deps.BaseURL = strings.TrimRight(deps.BaseURL, "/")
	return func(w http.ResponseWriter, r *http.Request) {
		// Resolve the upstream key: per-tenant BYOK first, platform
		// fallback second. Empty after both means the gateway has no
		// way to reach the upstream — return a 503 in Anthropic shape.
		apiKey := resolveKey(r.Context(), deps)
		if apiKey == "" {
			writeAnthropicError(w, http.StatusServiceUnavailable,
				"api_error", "no upstream Anthropic credential available; "+
					"set tenant BYOK via /admin/tenants/{id}/provider-credentials/anthropic "+
					"or configure ANTHROPIC_API_KEY on the gateway")
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeAnthropicError(w, http.StatusBadRequest,
				"invalid_request_error", "failed to read request body: "+err.Error())
			return
		}
		_ = r.Body.Close()
		upstreamReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost,
			deps.BaseURL+"/v1/messages", bytes.NewReader(body))
		if err != nil {
			writeAnthropicError(w, http.StatusInternalServerError,
				"api_error", "failed to build upstream request: "+err.Error())
			return
		}
		upstreamReq.Header.Set("x-api-key", apiKey)
		upstreamReq.Header.Set("Content-Type", "application/json")
		// anthropic-version is required; honor caller's choice or fall
		// back to the latest stable version we know about.
		if v := r.Header.Get("anthropic-version"); v != "" {
			upstreamReq.Header.Set("anthropic-version", v)
		} else {
			upstreamReq.Header.Set("anthropic-version", "2023-06-01")
		}
		if v := r.Header.Get("anthropic-beta"); v != "" {
			upstreamReq.Header.Set("anthropic-beta", v)
		}
		// Detect stream:true in the request body so we can switch to
		// SSE pass-through mode. We don't unmarshal the whole body —
		// just probe for the flag — so unknown fields in newer
		// Anthropic schema versions still travel intact to the upstream.
		streaming := isStreamingRequest(body)

		resp, err := deps.Client.Do(upstreamReq)
		if err != nil {
			writeAnthropicError(w, http.StatusBadGateway,
				"api_error", "upstream Anthropic call failed: "+err.Error())
			return
		}
		defer resp.Body.Close()

		// === Streaming path ==============================================
		// Inline DLP on streamed chunks: when deps.StreamDLP returns a
		// non-nil StreamRedactor for the request, every text_delta
		// event passes through it before reaching the customer. The
		// redactor parses Anthropic SSE, accumulates per-content-block
		// text with a sliding safety margin, and emits redacted
		// synthetic delta events so the SDK iterator sees clean text.
		// When StreamDLP is nil (e.g. tenant policy=allow), the bytes
		// flow verbatim. Either way, the upstream stream is never
		// buffered — first-byte latency stays under the upstream's
		// own SSE pacing.
		if streaming {
			ct := resp.Header.Get("Content-Type")
			if ct == "" {
				ct = "text/event-stream"
			}
			w.Header().Set("Content-Type", ct)
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")
			w.WriteHeader(resp.StatusCode)
			var sink io.Writer = w
			var redactor *infmw.StreamRedactor
			if deps.StreamDLP != nil {
				redactor = deps.StreamDLP(r.Context(), w)
				if redactor != nil {
					sink = redactor
				}
			}
			flusher, _ := w.(http.Flusher)
			buf := make([]byte, 4096)
			for {
				n, readErr := resp.Body.Read(buf)
				if n > 0 {
					if _, werr := sink.Write(buf[:n]); werr != nil {
						if redactor != nil {
							_ = redactor.Close()
						}
						return // client disconnected
					}
					if flusher != nil {
						flusher.Flush()
					}
				}
				if readErr != nil {
					if redactor != nil {
						_ = redactor.Close()
					}
					return
				}
			}
		}

		// === Non-streaming path ==========================================
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			writeAnthropicError(w, http.StatusBadGateway,
				"api_error", "failed to read upstream response: "+err.Error())
			return
		}
		// Pass-through. Upstream errors are already in Anthropic shape
		// so we forward them verbatim — no RFC-7807 reshaping.
		ct := resp.Header.Get("Content-Type")
		if ct == "" {
			ct = "application/json"
		}
		w.Header().Set("Content-Type", ct)
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(respBody)
		// Spend tracking on success only. We parse a small slice of the
		// response (model + usage); errors here are non-fatal because
		// the response has already been delivered.
		if resp.StatusCode == http.StatusOK && deps.Tracker != nil && deps.TenantCtx != nil {
			recordSpend(r.Context(), deps, respBody)
		}
	}
}

// isStreamingRequest probes the JSON body for `"stream": true` without
// fully unmarshalling so unknown fields in newer schemas still travel
// to the upstream. False on parse error so a malformed body falls
// back to non-streaming and the upstream returns a normal 4xx.
func isStreamingRequest(body []byte) bool {
	var probe struct {
		Stream bool `json:"stream"`
	}
	if err := json.Unmarshal(body, &probe); err != nil {
		return false
	}
	return probe.Stream
}

// resolveKey picks the upstream Anthropic key for a request. Per-
// tenant BYOK takes precedence; otherwise the platform-wide fallback
// (deps.APIKey) is used. Lookup errors fall through silently to the
// platform key so a transient DB outage doesn't block the request.
func resolveKey(ctx context.Context, deps Deps) string {
	if deps.BYOK == nil || deps.TenantCtx == nil {
		return deps.APIKey
	}
	tenantID, ok := deps.TenantCtx(ctx)
	if !ok {
		return deps.APIKey
	}
	key, err := deps.BYOK.Get(ctx, tenantID, "anthropic")
	if err == nil && key != "" {
		return key
	}
	return deps.APIKey
}

// recordSpend best-effort logs the call to spend.Tracker. Returns no
// error — by the time we get here the response is already on the wire.
func recordSpend(ctx context.Context, deps Deps, respBody []byte) {
	tenantID, ok := deps.TenantCtx(ctx)
	if !ok {
		return
	}
	var u usageFragment
	if err := json.Unmarshal(respBody, &u); err != nil {
		return
	}
	if u.Model == "" {
		return
	}
	_ = deps.Tracker.Record(infspend.Event{
		TenantID:         tenantID,
		Provider:         "anthropic",
		Model:            u.Model,
		PromptTokens:     u.Usage.InputTokens,
		CompletionTokens: u.Usage.OutputTokens,
		OccurredAt:       time.Now().UTC(),
	})
}

// writeAnthropicError emits an Anthropic-shape error envelope:
//
//	{"type": "error", "error": {"type": "<code>", "message": "<msg>"}}
//
// Claude SDKs parse this exact shape. Returning RFC-7807 here would
// crash the SDK so this shim is mandatory for drop-in compatibility.
// BEAT-PLAN Claude-Team C4.
func writeAnthropicError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	envelope := map[string]any{
		"type": "error",
		"error": map[string]any{
			"type":    code,
			"message": message,
		},
	}
	if err := json.NewEncoder(w).Encode(envelope); err != nil {
		// Best effort. We've already committed the status code so we
		// can't recover; just drop the connection.
		_ = err
	}
}

// ErrUpstreamUnavailable is returned by the platform-level health
// check when the upstream Anthropic service is unreachable for an
// extended window. Used by /anthropic/v1/health (future) so callers
// can detect outages before sending traffic.
var ErrUpstreamUnavailable = errors.New("anthropic_compat: upstream unavailable")

// ProbeUpstream checks reachability of the upstream Anthropic API.
// Lightweight HEAD against the base URL; a 4xx is good enough to
// confirm the host responds. Used by health checks; the handler
// itself does not call this on every request.
func ProbeUpstream(ctx context.Context, deps Deps) error {
	client := deps.Client
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		deps.BaseURL+"/v1/messages", nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUpstreamUnavailable, err)
	}
	_ = resp.Body.Close()
	return nil
}
