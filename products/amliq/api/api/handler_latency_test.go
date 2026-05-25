package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/pipeline"
)

// TestLatencyHandler_JSONShape confirms the public endpoint exposes
// exactly the latency-related fields — no queue depth, no cache
// stats — and returns the no-store cache header.
func TestLatencyHandler_JSONShape(t *testing.T) {
	m := pipeline.NewMetrics(func() int { return 0 })
	for _, v := range []int64{10, 20, 30, 40, 50, 60, 70, 80, 90, 100} {
		m.RecordScreening(v)
	}
	lh := NewLatencyHandler(m)
	rec := httptest.NewRecorder()
	lh.Get(rec, httptest.NewRequest("GET", "/health/latency", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store", cc)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("json unmarshal: %v", err)
	}
	data, _ := body["data"].(map[string]interface{})
	required := []string{
		"screenings_total", "screenings_per_second",
		"avg_latency_ms", "p50_latency_ms",
		"p95_latency_ms", "p99_latency_ms",
	}
	for _, k := range required {
		if _, ok := data[k]; !ok {
			t.Errorf("missing field %q in data", k)
		}
	}
	if _, leaked := data["queue_depth"]; leaked {
		t.Errorf("queue_depth should be admin-only, leaked in public response")
	}
	if _, leaked := data["cache_hit_rate"]; leaked {
		t.Errorf("cache_hit_rate should be admin-only, leaked in public response")
	}
}

// TestLatencyHandler_Unconfigured returns 503 when no metrics
// registered rather than crashing.
func TestLatencyHandler_Unconfigured(t *testing.T) {
	lh := NewLatencyHandler(nil)
	rec := httptest.NewRecorder()
	lh.Get(rec, httptest.NewRequest("GET", "/health/latency", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 503", rec.Code)
	}
}

// TestLatencyPage_ServesHTML checks the public HTML dashboard
// renders and references the JSON endpoint it polls.
func TestLatencyPage_ServesHTML(t *testing.T) {
	rec := httptest.NewRecorder()
	latencyPage(rec, httptest.NewRequest("GET", "/status", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	ct := rec.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "text/html") {
		t.Errorf("Content-Type = %q, want text/html...", ct)
	}
	if !strings.Contains(rec.Body.String(), "/health/latency") {
		t.Error("HTML missing reference to /health/latency")
	}
	if !strings.Contains(rec.Body.String(), "AMLIQ") {
		t.Error("HTML missing AMLIQ brand")
	}
}
