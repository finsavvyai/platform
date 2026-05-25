package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()

	dir := t.TempDir()
	db, err := storage.Open(storage.Config{Driver: "sqlite", Path: dir + "/router_test.db"})
	if err != nil {
		t.Fatalf("storage.Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	logger := logging.NewDefault()
	manager := integrations.NewManager(logger)
	claude := aianalysis.NewClaudeAnalyzer(aianalysis.ClaudeConfig{Model: "claude-3-haiku"}, logger)
	heur := analysis.NewHeuristicAnalyzer()
	v, err := vault.New("router-test-key-32bytes-padding-x")
	if err != nil {
		t.Fatalf("vault.New: %v", err)
	}

	cfg := &config.Config{}
	cfg.Server.CORSOrigins = []string{"http://localhost:3000"}
	cfg.Auth.Disabled = true

	mux := New(db, manager, claude, heur, logger, v, cfg)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestRouterPublicRoutesRespond(t *testing.T) {
	srv := newTestServer(t)
	cases := []struct {
		path string
		want int
	}{
		{"/health", 200},
		{"/readiness", 200},
		{"/api/v1/status", 200},
		{"/llms.txt", 200},
		{"/.well-known/ai-plugin.json", 200},
		{"/.well-known/security.txt", 200},
		{"/api/v1/openapi.json", 200},
		{"/api/v1/connections", 200},
		{"/api/v1/providers", 200},
		{"/api/v1/dashboard/overview", 200},
		{"/api/v1/policies", 200},
		{"/api/v1/secrets", 200},
		{"/api/v1/embed/findings", 200},
		{"/api/v1/og/test.svg", 200},
		{"/api/v1/badge/test.svg", 200},
		{"/api/v1/security/audit", 200},
	}
	for _, tc := range cases {
		resp, err := http.Get(srv.URL + tc.path)
		if err != nil {
			t.Fatalf("%s: %v", tc.path, err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode != tc.want {
			t.Fatalf("%s: status=%d, want %d", tc.path, resp.StatusCode, tc.want)
		}
	}
}

func TestRouterUnknownAPIRouteReturns404(t *testing.T) {
	srv := newTestServer(t)
	resp, err := http.Get(srv.URL + "/api/v1/does-not-exist")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status=%d, want 404", resp.StatusCode)
	}
}

func TestRouterSPACatchAllServesDashboard(t *testing.T) {
	srv := newTestServer(t)
	resp, err := http.Get(srv.URL + "/some/dashboard/route")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d, want 200 (SPA catchall)", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct == "" {
		t.Fatalf("missing Content-Type")
	}
}

func TestRouterCORSHeaderEcho(t *testing.T) {
	srv := newTestServer(t)
	req, _ := http.NewRequest("OPTIONS", srv.URL+"/api/v1/status", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "GET")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("OPTIONS: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got == "" {
		t.Fatalf("missing CORS allow-origin in response")
	}
}
