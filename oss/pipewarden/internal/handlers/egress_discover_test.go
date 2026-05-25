package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

func TestEgressDiscover_RejectsGET(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/egress/discover", nil)
	w := httptest.NewRecorder()
	h.EgressDiscover(w, r)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET should return 405, got %d", w.Code)
	}
}

func TestEgressDiscover_RejectsEmptyLogs(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodPost, "/api/v1/egress/discover", strings.NewReader(`{"logs":""}`))
	w := httptest.NewRecorder()
	h.EgressDiscover(w, r)
	if w.Code != http.StatusBadRequest {
		t.Errorf("empty logs should return 400, got %d", w.Code)
	}
}

func TestEgressDiscover_RejectsInvalidJSON(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodPost, "/api/v1/egress/discover", strings.NewReader(`not json`))
	w := httptest.NewRecorder()
	h.EgressDiscover(w, r)
	if w.Code != http.StatusBadRequest {
		t.Errorf("malformed JSON should return 400, got %d", w.Code)
	}
}

func TestEgressDiscover_ReturnsObservedAndSuggestion(t *testing.T) {
	logs := `+ curl https://stats.attacker.com/hit
+ wget https://logs.mycompany.com/foo
+ wget https://metrics.mycompany.com/bar`
	body, _ := json.Marshal(map[string]string{"logs": logs})

	h := &Handlers{}
	r := httptest.NewRequest(http.MethodPost, "/api/v1/egress/discover", strings.NewReader(string(body)))
	w := httptest.NewRecorder()
	h.EgressDiscover(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", w.Code, w.Body.String())
	}
	var resp struct {
		Observed     []map[string]any `json:"observed"`
		SuggestedEnv string           `json:"suggested_env"`
		Note         string           `json:"note"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid response: %v", err)
	}
	if len(resp.Observed) < 3 {
		t.Errorf("expected ≥3 observed hosts, got %d", len(resp.Observed))
	}
	if !strings.Contains(resp.SuggestedEnv, "*.mycompany.com") {
		t.Errorf("expected sibling subdomains to collapse to wildcard, got %q", resp.SuggestedEnv)
	}
	if resp.Note == "" {
		t.Errorf("note field should explain how to apply the suggestion")
	}
}

func TestSuggestBaseline_CollapsesSiblings(t *testing.T) {
	got := suggestBaseline(parseHosts("a.foo.com", "b.foo.com", "c.foo.com"))
	if got != "*.foo.com" {
		t.Errorf("3 siblings should collapse to *.foo.com, got %q", got)
	}
}

func TestSuggestBaseline_KeepsSingletons(t *testing.T) {
	got := suggestBaseline(parseHosts("only-one.example.com"))
	if got != "only-one.example.com" {
		t.Errorf("singleton should pass through verbatim, got %q", got)
	}
}

func TestSuggestBaseline_EmptyInput(t *testing.T) {
	if got := suggestBaseline(nil); got != "" {
		t.Errorf("empty input should yield empty string, got %q", got)
	}
}

func TestETLDPlusOne(t *testing.T) {
	cases := map[string]string{
		"foo.bar.com": "bar.com",
		"a.b.c.d.com": "d.com",
		"two.com":     "",
		"single":      "",
	}
	for in, want := range cases {
		got, ok := eTLDPlusOne(in)
		if want == "" {
			if ok {
				t.Errorf("eTLDPlusOne(%q) = (%q, true), want false", in, got)
			}
			continue
		}
		if !ok || got != want {
			t.Errorf("eTLDPlusOne(%q) = (%q, %v), want (%q, true)", in, got, ok, want)
		}
	}
}

// helpers

func parseHosts(hosts ...string) []analysis.EgressTarget {
	out := make([]analysis.EgressTarget, len(hosts))
	for i, h := range hosts {
		out[i] = analysis.EgressTarget{Host: h, Count: 1}
	}
	return out
}
