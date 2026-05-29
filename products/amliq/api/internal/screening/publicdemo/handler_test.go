package publicdemo

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/screening"
)

// fixturesRoot resolves the repo-rooted samples/screen directory, which
// is the canonical location for all public-demo fixtures. Resolving via
// runtime.Caller keeps the test runnable from any cwd.
func fixturesRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Join(filepath.Dir(file), "..", "..", "..", "samples", "screen")
}

func newTestHandler(t *testing.T) *Handler {
	t.Helper()
	fs, err := LoadFixtures(fixturesRoot(t))
	if err != nil {
		t.Fatalf("load fixtures: %v", err)
	}
	// Wire the in-memory embedding matcher so the public-demo handler
	// reaches Q21-Q28 evidence parity with the production layer cascade.
	// The matcher is offline (no DB/Redis/network) — see
	// screening/embedding_inmem.go.
	emb := screening.NewInMemoryEmbeddingMatcher(0, 0)
	eng := screening.NewEngine(nil, screening.WithEmbeddingMatcher(emb))
	var buf bytes.Buffer
	return NewHandlerWithEmbedding(fs, eng, emb, NewWriterAuditor(&buf))
}

func postJSON(t *testing.T, h http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost,
		"/api/v1/screen/public-demo", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

func decodeResp(t *testing.T, w *httptest.ResponseRecorder) Response {
	t.Helper()
	var resp Response
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v (body=%s)", err, w.Body.String())
	}
	return resp
}

func TestPublicDemo_MethodNotAllowed(t *testing.T) {
	h := newTestHandler(t)
	req := httptest.NewRequest(http.MethodGet,
		"/api/v1/screen/public-demo", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("want 405, got %d", w.Code)
	}
	if got := w.Header().Get("Allow"); got != "POST" {
		t.Fatalf("want Allow=POST, got %q", got)
	}
}

func TestPublicDemo_BadJSON(t *testing.T) {
	h := newTestHandler(t)
	w := postJSON(t, h, `{not json`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d (%s)", w.Code, w.Body.String())
	}
}

func TestPublicDemo_EmptyName(t *testing.T) {
	h := newTestHandler(t)
	w := postJSON(t, h, `{"name":""}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", w.Code)
	}
}

func TestPublicDemo_UnknownField(t *testing.T) {
	h := newTestHandler(t)
	w := postJSON(t, h, `{"name":"x","bogus":1}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for unknown field, got %d", w.Code)
	}
}

func TestPublicDemo_ThresholdOutOfRange(t *testing.T) {
	h := newTestHandler(t)
	w := postJSON(t, h, `{"name":"Vladimir Putin","threshold":1.5}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", w.Code)
	}
}

func TestPublicDemo_HappyPath_VladimirPutin(t *testing.T) {
	h := newTestHandler(t)
	w := postJSON(t, h, `{"name":"Vladimir Putin"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", w.Code, w.Body.String())
	}
	resp := decodeResp(t, w)
	if resp.Query != "Vladimir Putin" {
		t.Fatalf("query: want %q, got %q", "Vladimir Putin", resp.Query)
	}
	if resp.RiskLevel != "high" {
		t.Fatalf("riskLevel: want high, got %q", resp.RiskLevel)
	}
	if len(resp.Matches) == 0 {
		t.Fatal("expected at least one match")
	}
	if resp.LatencyMs < 0 {
		t.Fatalf("latencyMs negative: %d", resp.LatencyMs)
	}
	if resp.ScreenedAt == "" {
		t.Fatal("screenedAt must be set")
	}
}

func TestPublicDemo_ListsFilter(t *testing.T) {
	h := newTestHandler(t)
	w := postJSON(t, h, `{"name":"Vladimir Putin","lists":["ofac"]}`)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}
	resp := decodeResp(t, w)
	for _, m := range resp.Matches {
		for _, l := range m.Lists {
			if l != "ofac" {
				t.Fatalf("list filter leak: got %s", l)
			}
		}
	}
}

func TestPublicDemo_ThresholdDropsMatches(t *testing.T) {
	h := newTestHandler(t)
	// Without threshold: should yield matches.
	w1 := postJSON(t, h, `{"name":"Vladimir Putin"}`)
	r1 := decodeResp(t, w1)
	if len(r1.Matches) == 0 {
		t.Fatal("baseline matches expected")
	}
	// With threshold=0.99: very few matches survive.
	w2 := postJSON(t, h, `{"name":"Vladimir Putin","threshold":0.99}`)
	r2 := decodeResp(t, w2)
	if len(r2.Matches) >= len(r1.Matches) {
		t.Fatalf("threshold did not reduce matches: baseline=%d filtered=%d",
			len(r1.Matches), len(r2.Matches))
	}
}

func TestPublicDemo_PEPToggle(t *testing.T) {
	h := newTestHandler(t)
	w := postJSON(t, h, `{"name":"Recep Tayyip Erdogan","pep":true}`)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", w.Code, w.Body.String())
	}
	resp := decodeResp(t, w)
	var found bool
	for _, m := range resp.Matches {
		if m.PEPStatus.Status != "none" {
			found = true
			if !strings.Contains(m.PEPStatus.Position, "President") {
				t.Fatalf("expected PEP position to mention President, got %q",
					m.PEPStatus.Position)
			}
		}
	}
	if !found {
		t.Fatal("expected at least one match with pepStatus != none")
	}
}

func TestPublicDemo_PEPDefaultNone(t *testing.T) {
	h := newTestHandler(t)
	// PEP not requested: every match must default to "none".
	w := postJSON(t, h, `{"name":"Vladimir Putin"}`)
	resp := decodeResp(t, w)
	for _, m := range resp.Matches {
		if m.PEPStatus.Status != "none" {
			t.Fatalf("pep=false but match has pepStatus=%q", m.PEPStatus.Status)
		}
	}
}
