package middleware

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

func passOK() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`ok`))
	})
}

func TestRequestLogger_RecordsStatusAndIP(t *testing.T) {
	log := logging.NewDefault()
	mw := RequestLogger(log)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/foo", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.1, 10.0.0.2")

	mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("hi"))
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusTeapot {
		t.Errorf("status: got %d", rec.Code)
	}
	if rec.Body.String() != "hi" {
		t.Errorf("body: got %q", rec.Body.String())
	}
}

func TestMaxBodyBytes_RejectsOversizeBody(t *testing.T) {
	mw := MaxBodyBytes(8)

	called := false
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		_, err := io.ReadAll(r.Body)
		if err == nil {
			t.Error("expected ReadAll to fail past limit")
		}
		w.WriteHeader(http.StatusOK)
	}))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("0123456789ABCDEF"))
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("handler never reached")
	}
}

func TestMaxBodyBytes_GETSkipsLimit(t *testing.T) {
	mw := MaxBodyBytes(1)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", bytes.NewReader([]byte("anything")))
	mw(passOK()).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("GET should pass through; got %d", rec.Code)
	}
}

func TestMaxBodyBytes_DefaultLimitWhenZero(t *testing.T) {
	mw := MaxBodyBytes(0)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("hi"))
	mw(passOK()).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected default 1MB to allow tiny body; got %d", rec.Code)
	}
}

func TestSecurityHeaders_AllPresent(t *testing.T) {
	mw := SecurityHeaders()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	mw(passOK()).ServeHTTP(rec, req)

	want := map[string]string{
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "DENY",
		"X-XSS-Protection":          "1; mode=block",
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	}
	for k, v := range want {
		if got := rec.Header().Get(k); got != v {
			t.Errorf("%s: got %q want %q", k, got, v)
		}
	}
	if csp := rec.Header().Get("Content-Security-Policy"); csp == "" {
		t.Error("CSP missing")
	}
}

func TestCORS_AllowsListedOrigin(t *testing.T) {
	mw := CORS([]string{"https://app.example.com"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://app.example.com")
	mw(passOK()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Errorf("CORS origin: got %q", got)
	}
}

func TestCORS_BlocksUnlistedOrigin(t *testing.T) {
	mw := CORS([]string{"https://allowed.example.com"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	mw(passOK()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("blocked origin should not get CORS header; got %q", got)
	}
}

func TestCORS_WildcardAllows(t *testing.T) {
	mw := CORS([]string{"*"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://anywhere.example.com")
	mw(passOK()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://anywhere.example.com" {
		t.Errorf("wildcard CORS: got %q", got)
	}
}

func TestCORS_OptionsPreflightShortCircuits(t *testing.T) {
	mw := CORS([]string{"*"})
	called := false
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/", nil)
	req.Header.Set("Origin", "https://x.com")

	mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
	})).ServeHTTP(rec, req)

	if called {
		t.Error("OPTIONS should not reach next handler")
	}
	if rec.Code != http.StatusOK {
		t.Errorf("preflight status: got %d", rec.Code)
	}
}

func TestRecoverPanic_Returns500JSON(t *testing.T) {
	log := logging.NewDefault()
	mw := RecoverPanic(log)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/boom", nil)

	mw(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		panic(errors.New("kaboom"))
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status: got %d want 500", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "internal server error") {
		t.Errorf("body should contain canonical message; got %q", rec.Body.String())
	}
	if rec.Header().Get("Content-Type") != "application/json" {
		t.Errorf("CT: got %q", rec.Header().Get("Content-Type"))
	}
}

func TestRecoverPanic_NoPanicPassesThrough(t *testing.T) {
	log := logging.NewDefault()
	mw := RecoverPanic(log)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	mw(passOK()).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("non-panic should pass; got %d", rec.Code)
	}
}

func TestRequestID_AddsHeader(t *testing.T) {
	mw := RequestID()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	mw(passOK()).ServeHTTP(rec, req)

	if rid := rec.Header().Get("X-Request-ID"); rid == "" {
		t.Error("X-Request-ID missing")
	}
}

func TestContentType_DefaultsWhenUnset(t *testing.T) {
	mw := ContentType("application/json")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	mw(passOK()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("content-type: got %q", got)
	}
}

func TestContentType_PreservesExisting(t *testing.T) {
	mw := ContentType("application/json")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if got := rec.Header().Get("Content-Type"); got != "text/csv" {
		t.Errorf("existing content-type clobbered: got %q", got)
	}
}

func TestChain_AppliesInOrder(t *testing.T) {
	order := []string{}
	mwA := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order = append(order, "A-pre")
			next.ServeHTTP(w, r)
			order = append(order, "A-post")
		})
	}
	mwB := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order = append(order, "B-pre")
			next.ServeHTTP(w, r)
			order = append(order, "B-post")
		})
	}

	final := Chain(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		order = append(order, "core")
	}), mwA, mwB)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	final.ServeHTTP(rec, req)

	want := []string{"A-pre", "B-pre", "core", "B-post", "A-post"}
	if len(order) != len(want) {
		t.Fatalf("order length: got %v want %v", order, want)
	}
	for i, v := range want {
		if order[i] != v {
			t.Errorf("order[%d]: got %q want %q", i, order[i], v)
		}
	}
}

func TestStatusWriter_CapturesCodeAndPassesWrite(t *testing.T) {
	rec := httptest.NewRecorder()
	sw := &statusWriter{ResponseWriter: rec, statusCode: http.StatusOK}

	sw.WriteHeader(http.StatusCreated)
	if sw.statusCode != http.StatusCreated {
		t.Errorf("status capture: got %d", sw.statusCode)
	}

	n, err := sw.Write([]byte("payload"))
	if err != nil || n != 7 {
		t.Errorf("write: n=%d err=%v", n, err)
	}
	if rec.Body.String() != "payload" {
		t.Errorf("underlying body: got %q", rec.Body.String())
	}
}

func TestClientIP_XForwardedForFirst(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-Forwarded-For", "203.0.113.1, 10.0.0.5")
	if got := clientIP(r); got != "203.0.113.1" {
		t.Errorf("XFF: got %q", got)
	}
}

func TestClientIP_XRealIP(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-Real-IP", "198.51.100.7")
	if got := clientIP(r); got != "198.51.100.7" {
		t.Errorf("X-Real-IP: got %q", got)
	}
}

func TestClientIP_RemoteAddr(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "192.0.2.4:51000"
	if got := clientIP(r); got != "192.0.2.4" {
		t.Errorf("RemoteAddr: got %q", got)
	}
}

func TestClientIP_RemoteAddrNoPort(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "no-port-here"
	if got := clientIP(r); got != "no-port-here" {
		t.Errorf("malformed RemoteAddr fallback: got %q", got)
	}
}
