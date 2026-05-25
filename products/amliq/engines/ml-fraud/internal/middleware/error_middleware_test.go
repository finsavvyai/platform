package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRequestSizeLimit_UnderLimit(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	router := gin.New()
	router.Use(eh.RequestSizeLimit(1024))
	router.POST("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/test", strings.NewReader("small"))
	req.ContentLength = 5
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequestSizeLimit_OverLimit(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	router := gin.New()
	router.Use(eh.RequestSizeLimit(10))
	router.POST("/test", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/test", strings.NewReader("very large body content"))
	req.ContentLength = 100
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}

func TestRequestID_GeneratesWhenMissing(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	router := gin.New()
	router.Use(eh.RequestID())
	router.GET("/test", func(c *gin.Context) {
		reqID := c.GetString("request_id")
		c.String(200, reqID)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
	assert.Contains(t, w.Body.String(), "req_")
}

func TestRequestID_PreservesExisting(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	router := gin.New()
	router.Use(eh.RequestID())
	router.GET("/test", func(c *gin.Context) {
		reqID := c.GetString("request_id")
		c.String(200, reqID)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Request-ID", "existing-id-123")
	router.ServeHTTP(w, req)
	assert.Equal(t, "existing-id-123", w.Header().Get("X-Request-ID"))
	assert.Equal(t, "existing-id-123", w.Body.String())
}

func TestHandlePanic_StringPanic(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	router := gin.New()
	router.Use(eh.Middleware())
	router.GET("/test", func(c *gin.Context) { panic("string panic") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), "INTERNAL_ERROR")
}

func TestHandlePanic_ErrorPanic(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	router := gin.New()
	router.Use(eh.Middleware())
	router.GET("/test", func(c *gin.Context) {
		panic(assert.AnError)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandlePanic_UnknownPanic(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	router := gin.New()
	router.Use(eh.Middleware())
	router.GET("/test", func(c *gin.Context) { panic(42) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandleError_MaxBytesError(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api", nil)

	eh.HandleError(c, &http.MaxBytesError{}, http.StatusRequestEntityTooLarge)
	assert.Contains(t, w.Body.String(), "REQUEST_TOO_LARGE")
}

func TestRandomString(t *testing.T) {
	s := randomString(10)
	assert.Len(t, s, 10)
}

func TestLogError_AllLevels(t *testing.T) {
	levels := []string{"debug", "info", "warn", "error"}
	for _, lvl := range levels {
		t.Run(lvl, func(t *testing.T) {
			cfg := &ErrorConfig{LogLevel: lvl, RequestIDHeader: "X-Request-ID"}
			eh, logger := newTestErrorHandler(cfg)
			resp := &ErrorResponse{Code: "TEST", Path: "/test", Method: "GET"}
			eh.logError(resp, errors.New("test"))
			assert.Equal(t, lvl, logger.lastLevel)
		})
	}
}

func TestGenerateRequestID(t *testing.T) {
	id := generateRequestID()
	assert.Contains(t, id, "req_")
	assert.Greater(t, len(id), 10)
}
