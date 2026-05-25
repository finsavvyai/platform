package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSubProcessorChangelogServesJSON(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet,
		"/api/v1/privacy/subprocessors/changelog", nil)
	w := httptest.NewRecorder()
	HandleSubProcessorChangelog(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("not JSON: %v", err)
	}
	data, _ := body["data"].(map[string]any)
	if _, ok := data["changelog"]; !ok {
		t.Errorf("changelog key missing: %v", data)
	}
}

func TestSubProcessorChangelogNonEmpty(t *testing.T) {
	if len(SubProcessorChangelog()) == 0 {
		t.Fatal("changelog must not be empty")
	}
	for _, c := range SubProcessorChangelog() {
		if c.Date == "" || c.Action == "" || c.Name == "" {
			t.Errorf("incomplete changelog entry: %+v", c)
		}
	}
}
