// Tests for /v1/chat: real Anthropic adapter against an httptest
// upstream + in-memory spend Sink/Pricing/Usage/Limits.
//
// BEAT-PLAN S1.2 acceptance: when used_cents+upcoming_call_cost
// would exceed the hard cap, the handler must return 402 BEFORE
// calling the upstream. When under cap, the upstream is hit exactly
// once and one spend_events row is recorded.

package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	domspend "github.com/sdlc-ai/platform/services/gateway/internal/domain/spend"
	infllm "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/llm"
	infspend "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/spend"
)

func TestChat_HappyPath_RecordsSpend(t *testing.T) {
	tenantID := uuid.New()
	upstream := newAnthropicMock(t, 12, 7)
	defer upstream.Close()

	sink := newMemSink()
	pricing := memPricing{cents: 5}
	tracker := infspend.NewTracker(sink, pricing, 0)
	defer tracker.Close()

	deps := Deps{
		Provider:  infllm.NewAnthropic("dev-key", upstream.URL),
		Tracker:   tracker,
		Usage:     memUsage{used: 0},
		Limits:    memLimits{cfg: domspend.LimitConfig{Scope: "tenant", ScopeID: tenantID, MonthlyUSDCents: 10_000, HardCapPct: 100, SoftCapPct: 80}},
		TenantCtx: func(_ context.Context) (uuid.UUID, bool) { return tenantID, true },
	}
	srv := httptest.NewServer(Chat(deps))
	defer srv.Close()

	resp := postJSON(t, srv.URL, `{"model":"claude-3-haiku-20240307","messages":[{"role":"user","content":"hi"}]}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d want 200", resp.StatusCode)
	}
	tracker.Close()
	if got := sink.count(); got != 1 {
		t.Fatalf("spend_events rows=%d want 1", got)
	}
}

func TestChat_OverHardCap_Returns402(t *testing.T) {
	tenantID := uuid.New()
	hits := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	deps := Deps{
		Provider: infllm.NewAnthropic("dev-key", upstream.URL),
		Usage:    memUsage{used: 10_000},
		Limits:   memLimits{cfg: domspend.LimitConfig{Scope: "tenant", ScopeID: tenantID, MonthlyUSDCents: 10_000, HardCapPct: 100}},
		TenantCtx: func(_ context.Context) (uuid.UUID, bool) { return tenantID, true },
	}
	srv := httptest.NewServer(Chat(deps))
	defer srv.Close()

	resp := postJSON(t, srv.URL, `{"model":"claude-3-haiku-20240307","messages":[{"role":"user","content":"hi"}]}`)
	if resp.StatusCode != http.StatusPaymentRequired {
		t.Fatalf("status=%d want 402", resp.StatusCode)
	}
	if hits != 0 {
		t.Fatalf("upstream calls=%d want 0 (must short-circuit before upstream)", hits)
	}
}

func TestChat_NoLimit_FailsOpen(t *testing.T) {
	tenantID := uuid.New()
	upstream := newAnthropicMock(t, 1, 1)
	defer upstream.Close()

	deps := Deps{
		Provider:  infllm.NewAnthropic("dev-key", upstream.URL),
		Usage:     memUsage{used: 0},
		Limits:    memLimits{err: infspend.ErrNoLimit},
		TenantCtx: func(_ context.Context) (uuid.UUID, bool) { return tenantID, true },
	}
	srv := httptest.NewServer(Chat(deps))
	defer srv.Close()

	resp := postJSON(t, srv.URL, `{"model":"claude-3-haiku-20240307","messages":[{"role":"user","content":"hi"}]}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d want 200", resp.StatusCode)
	}
}

// --- helpers --------------------------------------------------------

func postJSON(t *testing.T, url, body string) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(http.MethodPost, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	return resp
}

func newAnthropicMock(t *testing.T, in, out int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"content":     []map[string]string{{"type": "text", "text": "ok"}},
			"model":       "claude-3-haiku-20240307",
			"stop_reason": "end_turn",
			"usage":       map[string]int{"input_tokens": in, "output_tokens": out},
		})
	}))
}

type memSink struct {
	mu  sync.Mutex
	rows []infspend.Event
}

func newMemSink() *memSink { return &memSink{} }

func (m *memSink) Write(_ context.Context, ev infspend.Event, _ int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rows = append(m.rows, ev)
	return nil
}
func (m *memSink) count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.rows)
}

type memPricing struct{ cents int64 }

func (p memPricing) CostCents(_ context.Context, _, _ string, _, _ int) (int64, error) {
	return p.cents, nil
}

type memUsage struct{ used int64 }

func (m memUsage) MonthToDateCents(_ context.Context, _ uuid.UUID) (int64, error) {
	return m.used, nil
}

type memLimits struct {
	cfg domspend.LimitConfig
	err error
}

func (m memLimits) ForTenant(_ context.Context, _ uuid.UUID) (domspend.LimitConfig, error) {
	if m.err != nil {
		return domspend.LimitConfig{}, m.err
	}
	return m.cfg, nil
}

// drainTracker is a tiny convenience used by callers that need the
// async drain to complete before asserting on sink rows. The Tracker
// drains on Close so we don't need a separate primitive — keep this
// here to document why tests call tracker.Close() before count().
var _ = time.Second
