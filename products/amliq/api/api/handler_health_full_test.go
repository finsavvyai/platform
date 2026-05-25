package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthFullSkippedWithNilDB(t *testing.T) {
	h := NewHealthHandler(nil, "test")
	r := httptest.NewRequest(http.MethodGet, "/health/full", nil)
	w := httptest.NewRecorder()
	h.HealthFull(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("nil DB → all subsystems skipped → status ok; got %d body=%s",
			w.Code, w.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("not JSON: %v", err)
	}
	data, _ := body["data"].(map[string]any)
	if data["status"] != "ok" {
		t.Errorf("want overall ok, got %v", data["status"])
	}
	subs, _ := data["subsystems"].([]any)
	if len(subs) < 2 {
		t.Errorf("want ≥2 subsystems, got %d", len(subs))
	}
}
