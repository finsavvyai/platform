package metrics

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestStatusClass(t *testing.T) {
	cases := map[int]string{
		0:   "unknown",
		100: "1xx",
		200: "2xx",
		301: "3xx",
		404: "4xx",
		500: "5xx",
	}
	for code, want := range cases {
		if got := statusClass(code); got != want {
			t.Errorf("statusClass(%d) = %q, want %q", code, got, want)
		}
	}
}

func TestHandlerExposesRegisteredMetrics(t *testing.T) {
	RecordHTTP("GET", 200, 12*time.Millisecond)
	RecordScan("heuristic", "success")
	RecordFinding("critical")

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("metrics endpoint returned %d", rec.Code)
	}
	body, _ := io.ReadAll(rec.Body)
	out := string(body)

	required := []string{
		"pipewarden_http_requests_total",
		"pipewarden_http_request_duration_seconds",
		"pipewarden_scans_total",
		"pipewarden_findings_total",
	}
	for _, name := range required {
		if !strings.Contains(out, name) {
			t.Errorf("metric %q missing from /metrics output", name)
		}
	}
}

func TestRecordHTTPClassifiesStatus(t *testing.T) {
	RecordHTTP("POST", 201, time.Millisecond)
	RecordHTTP("POST", 503, time.Millisecond)

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, req)
	body, _ := io.ReadAll(rec.Body)
	out := string(body)

	if !strings.Contains(out, `status_class="2xx"`) {
		t.Error("expected 2xx label after success record")
	}
	if !strings.Contains(out, `status_class="5xx"`) {
		t.Error("expected 5xx label after failure record")
	}
}
