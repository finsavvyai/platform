// Behavior tests for the Claude Team drop-in /v1/messages endpoint.
// Each test proves the handler does what the Done-when bullets in
// CLAUDE-TEAM-DROP-IN-GAPS.md claim — not just that the function
// compiles. Wiring into the chain is verified separately by the
// router-level test suite; here we exercise the handler in isolation
// with a stubbed upstream.
package anthropic_compat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// fakeBYOKResolver implements BYOKLookup for unit tests so we can
// exercise the BYOK precedence path without a Postgres fixture.
type fakeBYOKResolver struct {
	key      string
	notFound bool
}

func (f *fakeBYOKResolver) Get(_ context.Context, _ uuid.UUID, _ string) (string, error) {
	if f.notFound {
		return "", errors.New("byok: no per-tenant credential")
	}
	return f.key, nil
}

func uuidMust(t *testing.T, s string) uuid.UUID {
	t.Helper()
	id, err := uuid.Parse(s)
	if err != nil {
		t.Fatalf("uuid.Parse(%q): %v", s, err)
	}
	return id
}

// TestMessages_PassesThroughBodyToUpstream covers the core Done-when:
// the handler must forward the customer's request body verbatim so
// future Anthropic schema additions don't require a gateway release.
func TestMessages_PassesThroughBodyToUpstream(t *testing.T) {
	var capturedBody []byte
	var capturedAPIKey string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedBody, _ = io.ReadAll(r.Body)
		capturedAPIKey = r.Header.Get("x-api-key")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"msg_01","model":"claude-3-haiku-20240307","role":"assistant","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","usage":{"input_tokens":7,"output_tokens":1}}`))
	}))
	defer upstream.Close()

	h := Messages(Deps{APIKey: "sk-ant-test", BaseURL: upstream.URL})

	reqBody := `{"model":"claude-3-haiku-20240307","messages":[{"role":"user","content":"hello"}],"max_tokens":16}`
	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%q", rec.Code, rec.Body.String())
	}
	if string(capturedBody) != reqBody {
		t.Fatalf("upstream body = %q, want verbatim %q", capturedBody, reqBody)
	}
	if capturedAPIKey != "sk-ant-test" {
		t.Fatalf("upstream x-api-key = %q, want sk-ant-test", capturedAPIKey)
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response body not JSON: %v; body=%q", err, rec.Body.String())
	}
	if resp["id"] != "msg_01" {
		t.Fatalf("response id = %v, want msg_01", resp["id"])
	}
}

// TestMessages_ForwardsAnthropicHeaders covers another Done-when:
// `anthropic-version` and `anthropic-beta` headers must reach the
// upstream so customers can opt into beta features without a
// gateway change.
func TestMessages_ForwardsAnthropicHeaders(t *testing.T) {
	var capturedVersion, capturedBeta string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedVersion = r.Header.Get("anthropic-version")
		capturedBeta = r.Header.Get("anthropic-beta")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"msg_02"}`))
	}))
	defer upstream.Close()

	h := Messages(Deps{APIKey: "sk-ant-test", BaseURL: upstream.URL})

	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages",
		strings.NewReader(`{"model":"x","messages":[]}`))
	req.Header.Set("anthropic-version", "2024-06-01")
	req.Header.Set("anthropic-beta", "tools-2024-04-04")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if capturedVersion != "2024-06-01" {
		t.Errorf("anthropic-version = %q, want 2024-06-01", capturedVersion)
	}
	if capturedBeta != "tools-2024-04-04" {
		t.Errorf("anthropic-beta = %q, want tools-2024-04-04", capturedBeta)
	}
}

// TestMessages_DefaultAnthropicVersion covers the fallback Done-when:
// when the caller omits anthropic-version we must inject one so the
// upstream doesn't reject the call. SDKs typically set it but raw
// curl users skip it.
func TestMessages_DefaultAnthropicVersion(t *testing.T) {
	var capturedVersion string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedVersion = r.Header.Get("anthropic-version")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer upstream.Close()

	h := Messages(Deps{APIKey: "sk-ant-test", BaseURL: upstream.URL})
	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if capturedVersion == "" {
		t.Fatal("expected default anthropic-version, got empty")
	}
}

// TestMessages_AnthropicErrorEnvelopeOnMisconfig covers C4: when the
// gateway is missing ANTHROPIC_API_KEY, the response must be in
// Anthropic's `{type: "error", error: {type, message}}` shape so the
// SDK surfaces a clean error instead of crashing on RFC-7807.
func TestMessages_AnthropicErrorEnvelopeOnMisconfig(t *testing.T) {
	h := Messages(Deps{APIKey: "", BaseURL: "https://api.anthropic.com"})

	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages",
		strings.NewReader(`{"model":"x"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	var env struct {
		Type  string `json:"type"`
		Error struct {
			Type    string `json:"type"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("response not JSON: %v; body=%q", err, rec.Body.String())
	}
	if env.Type != "error" {
		t.Errorf("envelope type = %q, want error", env.Type)
	}
	if env.Error.Type == "" {
		t.Error("envelope error.type is empty")
	}
	if env.Error.Message == "" {
		t.Error("envelope error.message is empty")
	}
}

// TestMessages_AnthropicErrorOnUpstreamFailure covers the transport-
// failure path of C4: when the upstream returns a network error,
// we still must emit an Anthropic-shape envelope.
func TestMessages_AnthropicErrorOnUpstreamFailure(t *testing.T) {
	h := Messages(Deps{
		APIKey:  "sk-ant-test",
		BaseURL: "http://127.0.0.1:1", // unreachable
	})

	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages",
		bytes.NewReader([]byte(`{}`)))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"type":"error"`)) {
		t.Fatalf("expected anthropic error envelope, got %q", rec.Body.String())
	}
}

// TestMessages_StreamingPassThrough covers Claude Team A2: when the
// caller sends `stream: true`, the gateway forwards the SSE stream
// byte-for-byte. Inline DLP on the stream is week-2; v1 just makes
// sure the SDK's iterator works.
func TestMessages_StreamingPassThrough(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher, _ := w.(http.Flusher)
		// Three events: message_start, content_block_delta,
		// message_stop — minimum that SDKs validate.
		events := []string{
			`event: message_start` + "\n" + `data: {"type":"message_start","message":{"id":"msg_99","model":"claude-3-haiku-20240307","role":"assistant","content":[]}}` + "\n\n",
			`event: content_block_delta` + "\n" + `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}` + "\n\n",
			`event: message_stop` + "\n" + `data: {"type":"message_stop"}` + "\n\n",
		}
		for _, e := range events {
			_, _ = w.Write([]byte(e))
			if flusher != nil {
				flusher.Flush()
			}
		}
	}))
	defer upstream.Close()

	h := Messages(Deps{APIKey: "sk-ant-test", BaseURL: upstream.URL})

	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages",
		strings.NewReader(`{"model":"claude-3-haiku-20240307","stream":true,"messages":[{"role":"user","content":"hi"}]}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "text/event-stream" {
		t.Errorf("Content-Type = %q, want text/event-stream", got)
	}
	body := rec.Body.String()
	for _, want := range []string{"message_start", "content_block_delta", `"text":"hi"`, "message_stop"} {
		if !strings.Contains(body, want) {
			t.Errorf("streamed body missing %q; got:\n%s", want, body)
		}
	}
}

// TestMessages_BYOKResolvesPerTenantKey covers Claude Team A3: when
// the BYOK repo returns a tenant-specific key, the upstream call
// must use it instead of the platform default. Validates the
// resolveKey precedence path.
func TestMessages_BYOKResolvesPerTenantKey(t *testing.T) {
	var capturedKey string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedKey = r.Header.Get("x-api-key")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"msg_42"}`))
	}))
	defer upstream.Close()

	platformKey := "sk-ant-platform"
	tenantKey := "sk-ant-tenant-byok-key"
	tenantID := uuidMust(t, "11111111-1111-4111-8111-111111111111")

	h := Messages(Deps{
		APIKey:  platformKey,
		BaseURL: upstream.URL,
		TenantCtx: func(_ context.Context) (uuid.UUID, bool) {
			return tenantID, true
		},
		BYOK: &fakeBYOKResolver{key: tenantKey},
	})

	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages",
		strings.NewReader(`{"model":"claude-3-haiku-20240307","messages":[]}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%q", rec.Code, rec.Body.String())
	}
	if capturedKey != tenantKey {
		t.Errorf("upstream x-api-key = %q, want tenant key %q (BYOK precedence broken)",
			capturedKey, tenantKey)
	}
}

// TestMessages_BYOKFallsBackToPlatformKey covers the fallback half
// of A3: when the tenant has no BYOK row, the upstream call uses
// the platform key so the platform-pays model still works.
func TestMessages_BYOKFallsBackToPlatformKey(t *testing.T) {
	var capturedKey string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedKey = r.Header.Get("x-api-key")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer upstream.Close()

	platformKey := "sk-ant-platform-fallback"
	h := Messages(Deps{
		APIKey:    platformKey,
		BaseURL:   upstream.URL,
		TenantCtx: func(_ context.Context) (uuid.UUID, bool) { return uuid.Nil, false },
		BYOK:      &fakeBYOKResolver{notFound: true},
	})

	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages",
		strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if capturedKey != platformKey {
		t.Errorf("upstream x-api-key = %q, want platform fallback %q",
			capturedKey, platformKey)
	}
}

// TestMessages_PassesThroughUpstreamErrorEnvelope covers another C4
// edge: when the upstream returns its own Anthropic-shape error
// (e.g. invalid model), we must forward it verbatim — no reshaping.
func TestMessages_PassesThroughUpstreamErrorEnvelope(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"type":"error","error":{"type":"invalid_request_error","message":"unknown model"}}`))
	}))
	defer upstream.Close()

	h := Messages(Deps{APIKey: "sk-ant-test", BaseURL: upstream.URL})

	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages",
		strings.NewReader(`{"model":"bogus"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (passed through)", rec.Code)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"unknown model"`)) {
		t.Fatalf("expected upstream error verbatim, got %q", rec.Body.String())
	}
}
