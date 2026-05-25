package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// expectedHeaders lists the 8 OWASP security headers and their values.
var expectedHeaders = map[string]string{
	"X-Frame-Options":          "DENY",
	"X-Content-Type-Options":   "nosniff",
	"X-XSS-Protection":         "1; mode=block",
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"Referrer-Policy":           "strict-origin-when-cross-origin",
	"Content-Security-Policy":   "default-src 'none'; frame-ancestors 'none'",
	"Cache-Control":             "no-store",
	"Permissions-Policy":        "geolocation=(), camera=(), microphone=()",
}

// verifyAllSecurityHeaders asserts that all 8 headers are present and correct.
func verifyAllSecurityHeaders(t *testing.T, w *httptest.ResponseRecorder) {
	t.Helper()
	for key, expected := range expectedHeaders {
		got := w.Header().Get(key)
		assert.Equal(t, expected, got, "header %s mismatch", key)
	}
}

// -- Gin middleware: success, error, unauthorized responses --

func ginRouterWithSecurityHeaders() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SecurityHeadersGin())
	r.GET("/ok", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	r.GET("/bad", func(c *gin.Context) { c.JSON(http.StatusBadRequest, gin.H{"error": "bad"}) })
	r.GET("/unauth", func(c *gin.Context) { c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"}) })
	r.OPTIONS("/preflight", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	return r
}

func TestContract_SecurityHeaders_Gin_200(t *testing.T) {
	r := ginRouterWithSecurityHeaders()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/ok", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	verifyAllSecurityHeaders(t, w)
}

func TestContract_SecurityHeaders_Gin_400(t *testing.T) {
	r := ginRouterWithSecurityHeaders()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/bad", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	verifyAllSecurityHeaders(t, w)
}

func TestContract_SecurityHeaders_Gin_401(t *testing.T) {
	r := ginRouterWithSecurityHeaders()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/unauth", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	verifyAllSecurityHeaders(t, w)
}

func TestContract_SecurityHeaders_Gin_Preflight(t *testing.T) {
	r := ginRouterWithSecurityHeaders()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodOptions, "/preflight", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	verifyAllSecurityHeaders(t, w)
}

// -- Chi middleware: success, error, unauthorized responses --

func chiHandlerWithSecurityHeaders(statusCode int) http.Handler {
	inner := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(statusCode)
	})
	return SecurityHeadersChi(inner)
}

func TestContract_SecurityHeaders_Chi_200(t *testing.T) {
	h := chiHandlerWithSecurityHeaders(http.StatusOK)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	verifyAllSecurityHeaders(t, w)
}

func TestContract_SecurityHeaders_Chi_400(t *testing.T) {
	h := chiHandlerWithSecurityHeaders(http.StatusBadRequest)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/bad", nil)
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	verifyAllSecurityHeaders(t, w)
}

func TestContract_SecurityHeaders_Chi_401(t *testing.T) {
	h := chiHandlerWithSecurityHeaders(http.StatusUnauthorized)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/unauth", nil)
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	verifyAllSecurityHeaders(t, w)
}

func TestContract_SecurityHeaders_Chi_Preflight(t *testing.T) {
	h := chiHandlerWithSecurityHeaders(http.StatusNoContent)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/preflight", nil)
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	verifyAllSecurityHeaders(t, w)
}

// TestContract_SecurityHeaders_Count verifies the map has exactly 8 entries.
func TestContract_SecurityHeaders_Count(t *testing.T) {
	assert.Len(t, SecurityHeaders, 8, "expected 8 OWASP security headers")
}
