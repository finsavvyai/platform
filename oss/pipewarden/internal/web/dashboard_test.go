package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDashboardHandlerServesIndex(t *testing.T) {
	srv := httptest.NewServer(DashboardHandler())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/index.html")
	if err != nil {
		t.Fatalf("GET index.html: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}

func TestSPAHandlerReturnsIndex(t *testing.T) {
	srv := httptest.NewServer(SPAHandler())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/anything-not-real")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "text/html") {
		t.Fatalf("Content-Type = %q, want text/html prefix", ct)
	}
}

func TestEmbedHandlerCORSAndCache(t *testing.T) {
	srv := httptest.NewServer(EmbedHandler())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/")
	if err != nil {
		t.Fatalf("GET embed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.Header.Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("missing CORS allow-origin")
	}
	if resp.Header.Get("Cache-Control") == "" {
		t.Fatalf("missing Cache-Control")
	}
}
