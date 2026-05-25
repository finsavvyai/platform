package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewHostAwareMux_NoProxyHosts(t *testing.T) {
	t.Setenv("TRANSPARENT_PROXY_HOSTS", "")
	direct := http.NewServeMux()
	direct.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("direct"))
	})
	h := NewHostAwareMux(direct, http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("anthropic-route"))
		}))
	req := httptest.NewRequest("GET", "/health", nil)
	req.Host = "api.anthropic.com" // would be hijacked if TPH set
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Body.String() != "direct" {
		t.Errorf("no TPH = always direct, got %q", rec.Body.String())
	}
}

func TestNewHostAwareMux_HijackHost(t *testing.T) {
	t.Setenv("TRANSPARENT_PROXY_HOSTS", "api.anthropic.com")
	direct := http.NewServeMux()
	direct.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("direct"))
	})
	h := NewHostAwareMux(direct, http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("anthropic-route"))
		}))

	// Hijacked host → routes to anthropicHandler
	req := httptest.NewRequest("GET", "/health", nil)
	req.Host = "api.anthropic.com"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Body.String() != "anthropic-route" {
		t.Errorf("hijacked host should route to anthropicHandler, got %q",
			rec.Body.String())
	}

	// Non-hijacked host → routes to direct mux
	req2 := httptest.NewRequest("GET", "/health", nil)
	req2.Host = "api.sdlc.cc"
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req2)
	if rec2.Body.String() != "direct" {
		t.Errorf("direct host should route to direct mux, got %q",
			rec2.Body.String())
	}
}

func TestNewHostAwareMux_HostWithPort(t *testing.T) {
	t.Setenv("TRANSPARENT_PROXY_HOSTS", "api.anthropic.com")
	direct := http.NewServeMux()
	h := NewHostAwareMux(direct, http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("matched"))
		}))
	req := httptest.NewRequest("GET", "/health", nil)
	req.Host = "api.anthropic.com:8443" // port stripped before match
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Body.String() != "matched" {
		t.Errorf("port-suffix host should still match, got %q",
			rec.Body.String())
	}
}

func TestStripPort(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"example.com", "example.com"},
		{"example.com:443", "example.com"},
		{"API.example.com:8080", "api.example.com"},
		{"", ""},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			if got := stripPort(tt.in); got != tt.want {
				t.Errorf("stripPort(%q)=%q want %q", tt.in, got, tt.want)
			}
		})
	}
}
