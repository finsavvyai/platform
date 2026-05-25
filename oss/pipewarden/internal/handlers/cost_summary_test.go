package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/metrics"
)

func TestCostSummary_ReturnsJSON(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/cost-summary", nil)
	w := httptest.NewRecorder()
	h.CostSummary(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Errorf("Content-Type = %q", ct)
	}
	var s metrics.CostSummary
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil {
		t.Fatalf("response is not valid CostSummary JSON: %v", err)
	}
}

func TestCostSummary_HasNoStoreCacheHeader(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/cost-summary", nil)
	w := httptest.NewRecorder()
	h.CostSummary(w, r)
	if cc := w.Header().Get("Cache-Control"); cc != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store (cost data must always be fresh)", cc)
	}
}
