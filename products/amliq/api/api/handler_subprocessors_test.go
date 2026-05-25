package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSubProcessorsDirectoryNotEmpty(t *testing.T) {
	subs := SubProcessors()
	if len(subs) == 0 {
		t.Fatal("subprocessor directory must not be empty")
	}
	for _, s := range subs {
		if s.Name == "" || s.Purpose == "" {
			t.Errorf("incomplete entry: %+v", s)
		}
	}
}

func TestHandleSubProcessorsServesJSON(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet,
		"/api/v1/privacy/subprocessors", nil)
	w := httptest.NewRecorder()
	HandleSubProcessors(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response not JSON: %v body=%s", err, w.Body.String())
	}
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data envelope: %s", w.Body.String())
	}
	if _, ok := data["subprocessors"]; !ok {
		t.Errorf("subprocessors key missing: %v", data)
	}
}
