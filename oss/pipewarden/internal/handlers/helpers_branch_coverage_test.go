package handlers

import (
	"crypto/tls"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
)

func TestIsHTTPSReqAllBranches(t *testing.T) {
	if isHTTPSReq(nil) {
		t.Fatal("nil req should be false")
	}

	req := httptest.NewRequest("GET", "/", nil)
	if isHTTPSReq(req) {
		t.Fatal("plain HTTP should be false")
	}

	req2 := httptest.NewRequest("GET", "/", nil)
	req2.TLS = &tls.ConnectionState{}
	if !isHTTPSReq(req2) {
		t.Fatal("req.TLS set should be true")
	}

	req3 := httptest.NewRequest("GET", "/", nil)
	req3.Header.Set("X-Forwarded-Proto", "https")
	if !isHTTPSReq(req3) {
		t.Fatal("X-Forwarded-Proto=https should be true")
	}
}

func TestPublicBaseURLPrefersConfig(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	h.cfg = &config.Config{}
	h.cfg.Server.PublicURL = "https://pipewarden.io/"
	req := httptest.NewRequest("GET", "/", nil)
	if got := h.publicBaseURL(req); got != "https://pipewarden.io" {
		t.Fatalf("cfg url: %q", got)
	}
}

func TestPublicBaseURLFallsBackToHost(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	h.cfg = nil
	req := httptest.NewRequest("GET", "/", nil)
	req.Host = "localhost:8080"
	if got := h.publicBaseURL(req); got != "http://localhost:8080" {
		t.Fatalf("fallback: %q", got)
	}
}

func TestPublicBaseURLHTTPSViaXFP(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	h.cfg = nil
	req := httptest.NewRequest("GET", "/", nil)
	req.Host = "pipewarden.io"
	req.Header.Set("X-Forwarded-Proto", "https")
	if got := h.publicBaseURL(req); !strings.HasPrefix(got, "https://") {
		t.Fatalf("XFP→https: %q", got)
	}
}

func TestGitHubRedirectURIWithPublicURL(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	h.cfg = &config.Config{}
	h.cfg.Server.PublicURL = "https://pipewarden.io"
	req := httptest.NewRequest("GET", "/", nil)
	req.Host = "internal:8080"
	got := h.githubRedirectURI(req)
	if !strings.HasPrefix(got, "https://pipewarden.io/api/v1/auth/github/callback") {
		t.Fatalf("redirect: %q", got)
	}
}

func TestDedupDeps(t *testing.T) {
	in := []analysis.Dependency{
		{Ecosystem: "go", Name: "x", Version: "1"},
		{Ecosystem: "go", Name: "x", Version: "1"}, // dup
		{Ecosystem: "go", Name: "y", Version: "2"},
		{Ecosystem: "npm", Name: "x", Version: "1"}, // same name, diff ecosystem
	}
	out := analysis.DedupDependencies(in)
	if len(out) != 3 {
		t.Fatalf("len=%d, want 3 (%v)", len(out), out)
	}
}

func TestDedupDepsEmpty(t *testing.T) {
	if got := analysis.DedupDependencies(nil); len(got) != 0 {
		t.Fatalf("nil: %v", got)
	}
}
