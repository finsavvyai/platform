package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestCORS_CredentialsNeverPairWithStarOrigin is the key regression test:
// browsers SILENTLY DROP cookies when both Allow-Origin: * and
// Allow-Credentials: true are present on the same response. So when
// credentials are sent, Allow-Origin must echo the specific origin.
func TestCORS_CredentialsNeverPairWithStarOrigin(t *testing.T) {
	h := CORS([]string{"*"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	r := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	r.Header.Set("Origin", "https://pipewarden.io")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	allowOrigin := w.Header().Get("Access-Control-Allow-Origin")
	allowCreds := w.Header().Get("Access-Control-Allow-Credentials")

	if allowOrigin == "*" && allowCreds == "true" {
		t.Fatal("INVALID: browser will drop cookie when Allow-Origin=* + Allow-Credentials=true")
	}
	if allowCreds == "true" && allowOrigin != "https://pipewarden.io" {
		t.Errorf("Allow-Origin must echo the specific origin when credentials are sent, got %q", allowOrigin)
	}
}

func TestCORS_NoOriginHeader_NoCORSResponse(t *testing.T) {
	h := CORS([]string{"https://pipewarden.io"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("no Origin header → no CORS response, got %q", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_DisallowedOrigin_NoHeaders(t *testing.T) {
	h := CORS([]string{"https://pipewarden.io"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Origin", "https://evil.example.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("disallowed origin must not get CORS headers, got %q", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_AllowedOrigin_EchoesOriginAndAddsVary(t *testing.T) {
	h := CORS([]string{"https://pipewarden.io", "https://pipewarden.com"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Origin", "https://pipewarden.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://pipewarden.com" {
		t.Errorf("Allow-Origin = %q, want https://pipewarden.com (echo, never *)", got)
	}
	if got := w.Header().Get("Vary"); got != "Origin" {
		t.Errorf("Vary should include Origin to prevent cache poisoning, got %q", got)
	}
	if got := w.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Errorf("Allow-Credentials should be true for allowed origins, got %q", got)
	}
}

func TestCORS_Wildcard_StillEchoesActualOrigin(t *testing.T) {
	h := CORS([]string{"*"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Origin", "https://pipewarden.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://pipewarden.com" {
		t.Errorf("wildcard config + cred mode must still echo specific origin, got %q", got)
	}
}

func TestCORS_OPTIONS_Returns200(t *testing.T) {
	h := CORS([]string{"https://pipewarden.io"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("preflight should not call next handler")
	}))
	r := httptest.NewRequest(http.MethodOptions, "/", nil)
	r.Header.Set("Origin", "https://pipewarden.io")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Errorf("OPTIONS preflight = %d, want 200", w.Code)
	}
}
