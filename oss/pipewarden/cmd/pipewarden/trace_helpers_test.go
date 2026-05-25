package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// Tests for waitForReady / doOne / driveLoad (defined in trace.go).
// These lived in setup_test.go before the open-core split moved
// setup.go to cmd/pipewarden-server; the helpers under test stayed
// here, so the tests come with them.

func TestWaitForReadyHappy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	if err := waitForReady(srv.URL, 2*time.Second); err != nil {
		t.Fatalf("ready: %v", err)
	}
}

func TestWaitForReadyTimesOut(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	err := waitForReady(srv.URL, 600*time.Millisecond)
	if err == nil || !strings.Contains(err.Error(), "not ready") {
		t.Fatalf("expected timeout error, got %v", err)
	}
}

func TestDoOneSendsRequest(t *testing.T) {
	called := make(chan string, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called <- r.Method + " " + r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	doOne(t.Context(), &http.Client{Timeout: 2 * time.Second}, "POST", srv.URL+"/test", `{"x":1}`)
	select {
	case got := <-called:
		if got != "POST /test" {
			t.Fatalf("got %q", got)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("server never called")
	}
}

func TestDoOneIgnoresNetworkError(t *testing.T) {
	doOne(t.Context(), &http.Client{Timeout: 50 * time.Millisecond}, "GET", "http://127.0.0.1:1/never-served", "")
	// No assertion — function intentionally silent.
}

func TestDriveLoadIssuesMultipleRequests(t *testing.T) {
	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	driveLoad(t.Context(), srv.URL, 250*time.Millisecond)
	if hits == 0 {
		t.Fatalf("expected at least one request")
	}
}
