package metrics

import (
	"bytes"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func TestRegistry_WriteText_ContainsAllSeries(t *testing.T) {
	reg := NewRegistry()
	reg.IncRequestOK()
	reg.IncRequestOK()
	reg.IncRequestError()
	reg.IncRequestQuotaExceeded()
	reg.IncRequestAuthFailed()
	reg.AddDLPRedactions(5)
	reg.ObserveLatencyMicros(1500)
	reg.ObserveLatencyMicros(2500)

	var buf bytes.Buffer
	reg.WriteText(&buf)
	out := buf.String()

	for _, want := range []string{
		"sdlc_requests_total_ok 2",
		"sdlc_requests_total_error 1",
		"sdlc_requests_total_quota_exceeded 1",
		"sdlc_requests_total_auth_failed 1",
		"sdlc_dlp_redactions_total 5",
		"sdlc_provider_latency_microseconds_count 2",
		"sdlc_provider_latency_microseconds_sum 4000",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in output\n%s", want, out)
		}
	}

	for _, want := range []string{"# HELP", "# TYPE"} {
		if !strings.Contains(out, want) {
			t.Errorf("scrape format missing %q (Prom requires per-series declarations)", want)
		}
	}
}

func TestHandler_ContentTypeAndBody(t *testing.T) {
	reg := NewRegistry()
	reg.IncRequestOK()
	rec := httptest.NewRecorder()
	Handler(reg)(rec, httptest.NewRequest("GET", "/metrics", nil))
	if rec.Code != 200 {
		t.Fatalf("got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/plain") {
		t.Errorf("Content-Type = %q, want text/plain", ct)
	}
	if !strings.Contains(rec.Body.String(), "sdlc_requests_total_ok 1") {
		t.Errorf("body missing series: %s", rec.Body.String())
	}
}

func TestRegistry_ConcurrentSafe(t *testing.T) {
	reg := NewRegistry()
	var wg sync.WaitGroup
	const n = 1000
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			reg.IncRequestOK()
			reg.ObserveLatencyMicros(100)
		}()
	}
	wg.Wait()

	var buf bytes.Buffer
	reg.WriteText(&buf)
	out := buf.String()
	if !strings.Contains(out, "sdlc_requests_total_ok 1000") {
		t.Errorf("expected 1000 OK requests after 1000 concurrent increments")
	}
	if !strings.Contains(out, "sdlc_provider_latency_microseconds_sum 100000") {
		t.Errorf("expected sum=100000")
	}
}
