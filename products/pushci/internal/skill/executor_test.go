package skill

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestReportInvocationNoOpWithoutFlag(t *testing.T) {
	t.Setenv("PUSHCI_TELEMETRY_ENABLED", "")
	var called int32
	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&called, 1)
	}))
	defer srv.Close()
	TelemetryAPIBase = srv.URL
	ReportInvocation("heal", "tok")
	time.Sleep(50 * time.Millisecond)
	if atomic.LoadInt32(&called) != 0 {
		t.Fatalf("telemetry should not send when flag is off")
	}
}

func TestReportInvocationSendsWithFlag(t *testing.T) {
	t.Setenv("PUSHCI_TELEMETRY_ENABLED", "1")
	done := make(chan string, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		done <- r.Header.Get("Authorization")
	}))
	defer srv.Close()
	TelemetryAPIBase = srv.URL
	ReportInvocation("heal", "tok-xyz")
	select {
	case auth := <-done:
		if auth != "Bearer tok-xyz" {
			t.Fatalf("expected Bearer tok-xyz, got %q", auth)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("telemetry event never arrived")
	}
}

func TestReportInvocationSkipsWithoutToken(t *testing.T) {
	t.Setenv("PUSHCI_TELEMETRY_ENABLED", "1")
	var called int32
	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&called, 1)
	}))
	defer srv.Close()
	TelemetryAPIBase = srv.URL
	ReportInvocation("heal", "")
	time.Sleep(50 * time.Millisecond)
	if atomic.LoadInt32(&called) != 0 {
		t.Fatalf("telemetry must not send without a token")
	}
}
