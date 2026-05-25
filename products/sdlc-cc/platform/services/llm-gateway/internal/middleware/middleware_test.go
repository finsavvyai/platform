package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func serve(method, path string, headers map[string]string, middlewares ...gin.HandlerFunc) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	for _, h := range middlewares {
		r.Use(h)
	}
	r.GET(path, func(c *gin.Context) {
		c.String(200, "ok")
	})
	r.OPTIONS(path, func(c *gin.Context) {})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	r.ServeHTTP(w, req)
	return w
}

func TestRequestID(t *testing.T) {
	w := serve("GET", "/", nil, RequestID())
	assert.Equal(t, 200, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

func TestRequestID_FromHeader(t *testing.T) {
	w := serve("GET", "/", map[string]string{"X-Request-ID": "custom-id"}, RequestID())
	assert.Equal(t, 200, w.Code)
	assert.Equal(t, "custom-id", w.Header().Get("X-Request-ID"))
}

func TestCORS(t *testing.T) {
	w := serve("GET", "/", nil, CORS())
	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
	assert.NotEmpty(t, w.Header().Get("Access-Control-Allow-Methods"))
}

func TestCORS_Options(t *testing.T) {
	w := serve("OPTIONS", "/", nil, CORS())
	assert.Equal(t, 204, w.Code)
}

func TestAuthentication_NoHeader(t *testing.T) {
	w := serve("GET", "/", nil, Authentication())
	assert.Equal(t, 401, w.Code)
}

func TestAuthentication_EmptyBearer(t *testing.T) {
	// "Bearer " + " " so extracted token is " " which trims to empty
	w := serve("GET", "/", map[string]string{"Authorization": "Bearer  "}, Authentication())
	assert.Equal(t, 401, w.Code)
}

func TestAuthentication_ValidToken(t *testing.T) {
	w := serve("GET", "/", map[string]string{"Authorization": "Bearer tok"}, Authentication())
	require.Equal(t, 200, w.Code)
}

func TestAdminAuth_NoKey(t *testing.T) {
	w := serve("GET", "/", nil, AdminAuth())
	assert.Equal(t, 401, w.Code)
}

func TestAdminAuth_InvalidKey(t *testing.T) {
	w := serve("GET", "/", map[string]string{"X-API-Key": "wrong"}, AdminAuth())
	assert.Equal(t, 401, w.Code)
}

func TestAdminAuth_ValidKey(t *testing.T) {
	w := serve("GET", "/", map[string]string{"X-API-Key": "admin-secret-key"}, AdminAuth())
	require.Equal(t, 200, w.Code)
}

func TestSecurity(t *testing.T) {
	w := serve("GET", "/", nil, Security())
	assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, "DENY", w.Header().Get("X-Frame-Options"))
}

func TestCompression(t *testing.T) {
	assert.NotNil(t, Compression())
}

func TestRateLimiting(t *testing.T) {
	w := serve("GET", "/", nil, RateLimiting())
	assert.Equal(t, 200, w.Code)
	assert.Equal(t, "1000", w.Header().Get("X-RateLimit-Limit"))
}
