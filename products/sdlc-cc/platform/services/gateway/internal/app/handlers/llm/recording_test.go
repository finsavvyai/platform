package llm

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/record"
	infllm "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/llm"
)

// stubRecorder is an in-memory recorder for behavior tests.
type stubRecorder struct {
	mu     sync.Mutex
	starts []uuid.UUID
	events []record.Event
	stops  []uuid.UUID
}

func (s *stubRecorder) Start(_ context.Context, sid, _ uuid.UUID, _ string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.starts = append(s.starts, sid)
	return nil
}

func (s *stubRecorder) Append(_ context.Context, _ uuid.UUID, ev record.Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events = append(s.events, ev)
	return nil
}

func (s *stubRecorder) Stop(_ context.Context, sid uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stops = append(s.stops, sid)
	return nil
}

func (s *stubRecorder) Active(_ uuid.UUID) (string, bool) { return "", false }

// stubProvider returns a canned LLM response with no upstream call.
type stubProvider struct{}

func (p *stubProvider) Name() string { return "stub" }

func (p *stubProvider) Generate(_ context.Context, _ infllm.Request) (*infllm.Response, error) {
	return &infllm.Response{
		Provider:         "stub",
		Model:            "test-model",
		Content:          "hello",
		PromptTokens:     10,
		CompletionTokens: 5,
	}, nil
}

func (p *stubProvider) Embed(_ context.Context, _ []string) ([][]float32, error) {
	return nil, errors.New("embed not supported")
}

func buildRecordingRouter(rec record.Recorder, enabled bool) http.Handler {
	tenantID := uuid.New()
	deps := Deps{
		Provider:  &stubProvider{},
		TenantCtx: func(_ context.Context) (uuid.UUID, bool) { return tenantID, true },
		Recorder:  rec,
		RecordingEnabled: func(_ context.Context, _ uuid.UUID) bool {
			return enabled
		},
	}
	return Chat(deps)
}

func postChat(t *testing.T, h http.Handler) *httptest.ResponseRecorder {
	t.Helper()
	body := `{"model":"test-model","messages":[{"role":"user","content":"hello"}],"max_tokens":100}`
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

// TestRecording_WritesEventsWhenEnabled proves that a successful POST /v1/chat
// triggers Start + at least two Append calls + Stop on the recorder when
// RecordingEnabled returns true. This is the no-bluff bar: the recorder is
// called through the real Chat() handler, not via a direct captureRecording
// call.
func TestRecording_WritesEventsWhenEnabled(t *testing.T) {
	rec := &stubRecorder{}
	h := buildRecordingRouter(rec, true)

	w := postChat(t, h)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	rec.mu.Lock()
	defer rec.mu.Unlock()

	if len(rec.starts) != 1 {
		t.Fatalf("want 1 Start, got %d", len(rec.starts))
	}
	// captureRecording emits: request event + response event = 2 Append calls.
	if len(rec.events) < 2 {
		t.Fatalf("want ≥2 events (request+response), got %d", len(rec.events))
	}
	if rec.events[0].Type != "request" {
		t.Errorf("events[0].Type: want 'request', got %q", rec.events[0].Type)
	}
	if rec.events[1].Type != "response" {
		t.Errorf("events[1].Type: want 'response', got %q", rec.events[1].Type)
	}
	if len(rec.stops) != 1 {
		t.Fatalf("want 1 Stop, got %d", len(rec.stops))
	}
}

// TestRecording_SkipsWhenDisabled proves that POST /v1/chat writes zero
// rows when RecordingEnabled returns false, even though a Recorder is wired.
func TestRecording_SkipsWhenDisabled(t *testing.T) {
	rec := &stubRecorder{}
	h := buildRecordingRouter(rec, false)

	w := postChat(t, h)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}

	rec.mu.Lock()
	defer rec.mu.Unlock()

	if len(rec.starts) != 0 {
		t.Fatalf("want 0 starts when disabled, got %d", len(rec.starts))
	}
	if len(rec.events) != 0 {
		t.Fatalf("want 0 events when disabled, got %d", len(rec.events))
	}
	if len(rec.stops) != 0 {
		t.Fatalf("want 0 stops when disabled, got %d", len(rec.stops))
	}
}

// TestRecording_SkipsWhenNoRecorder proves that Chat degrades gracefully
// (no panic, returns 200) when Recorder is nil.
func TestRecording_SkipsWhenNoRecorder(t *testing.T) {
	h := buildRecordingRouter(nil, true)
	w := postChat(t, h)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}
}
