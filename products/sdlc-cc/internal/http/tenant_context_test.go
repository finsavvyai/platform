package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/sdlc-cc/internal/tenant"
)

func TestWithTenantResolver_AttachesTenantID(t *testing.T) {
	resolver := tenant.NewNetworkMap([]tenant.Row{
		{CIDR: "10.0.0.0/8", TenantID: "tnt_corp"},
	})

	var seen string
	h := WithTenantResolver(resolver, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = TenantIDFromContext(r.Context())
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "10.1.2.3:55555"
	h.ServeHTTP(httptest.NewRecorder(), req)

	if seen != "tnt_corp" {
		t.Fatalf("expected tnt_corp on context, got %q", seen)
	}
}

func TestWithTenantResolver_PrefersXFF(t *testing.T) {
	resolver := tenant.NewNetworkMap([]tenant.Row{
		{CIDR: "203.0.113.0/24", TenantID: "tnt_xff"},
	})
	var seen string
	h := WithTenantResolver(resolver, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = TenantIDFromContext(r.Context())
	}))
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.5, 10.0.0.1")
	req.RemoteAddr = "10.1.2.3:55555"
	h.ServeHTTP(httptest.NewRecorder(), req)
	if seen != "tnt_xff" {
		t.Fatalf("expected tnt_xff (from XFF), got %q", seen)
	}
}

func TestWithTenantResolver_NilPassthrough(t *testing.T) {
	called := false
	h := WithTenantResolver(nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
	if !called {
		t.Fatal("nil resolver should pass through")
	}
}

func TestWithTenantResolver_NoMatch_EmptyContext(t *testing.T) {
	resolver := tenant.NewNetworkMap([]tenant.Row{
		{CIDR: "10.0.0.0/8", TenantID: "tnt_corp"},
	})
	var seen string
	h := WithTenantResolver(resolver, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = TenantIDFromContext(r.Context())
	}))
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "172.16.0.1:443"
	h.ServeHTTP(httptest.NewRecorder(), req)
	if seen != "" {
		t.Fatalf("no match should leave context empty, got %q", seen)
	}
}
