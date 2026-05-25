package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type mockLogger struct {
	lastLevel string
	lastMsg   string
}

func (m *mockLogger) Error(msg string, fields ...interface{}) { m.lastLevel = "error"; m.lastMsg = msg }
func (m *mockLogger) Warn(msg string, fields ...interface{})  { m.lastLevel = "warn"; m.lastMsg = msg }
func (m *mockLogger) Info(msg string, fields ...interface{})  { m.lastLevel = "info"; m.lastMsg = msg }
func (m *mockLogger) Debug(msg string, fields ...interface{}) { m.lastLevel = "debug"; m.lastMsg = msg }

func init() { gin.SetMode(gin.TestMode) }

func newTestErrorHandler(cfg *ErrorConfig) (*ErrorHandler, *mockLogger) {
	logger := &mockLogger{}
	if cfg == nil {
		cfg = &ErrorConfig{
			Environment:     "test",
			LogLevel:        "error",
			RequestIDHeader: "X-Request-ID",
			MaxResponseSize: 1 << 20,
		}
	}
	return NewErrorHandler(cfg, logger), logger
}

func TestNewErrorHandler_DefaultConfig(t *testing.T) {
	logger := &mockLogger{}
	eh := NewErrorHandler(nil, logger)
	assert.NotNil(t, eh)
	assert.Equal(t, "production", eh.config.Environment)
	assert.Equal(t, "X-Request-ID", eh.config.RequestIDHeader)
}

func TestNewErrorHandler_CustomConfig(t *testing.T) {
	cfg := &ErrorConfig{Environment: "staging", LogLevel: "debug", RequestIDHeader: "X-Trace"}
	eh, _ := newTestErrorHandler(cfg)
	assert.Equal(t, "staging", eh.config.Environment)
}

func TestHandleError_GenericError(t *testing.T) {
	eh, logger := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)

	eh.HandleError(c, errors.New("something failed"), http.StatusInternalServerError)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), "INTERNAL_ERROR")
	assert.Equal(t, "error", logger.lastLevel)
}

func TestHandleError_RequiredError(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api", nil)

	eh.HandleError(c, errors.New("field required"), http.StatusBadRequest)
	assert.Contains(t, w.Body.String(), "MISSING_FIELD")
}

func TestHandleError_InvalidError(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api", nil)

	eh.HandleError(c, errors.New("invalid input data"), http.StatusBadRequest)
	assert.Contains(t, w.Body.String(), "INVALID_INPUT")
}

func TestHandleError_UnauthorizedError(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api", nil)

	eh.HandleError(c, errors.New("unauthorized access"), http.StatusUnauthorized)
	assert.Contains(t, w.Body.String(), "UNAUTHORIZED")
}

func TestHandleError_ForbiddenError(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api", nil)

	eh.HandleError(c, errors.New("forbidden resource"), http.StatusForbidden)
	assert.Contains(t, w.Body.String(), "FORBIDDEN")
}

func TestHandleError_NotFoundError(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/missing", nil)

	eh.HandleError(c, errors.New("resource not found"), http.StatusNotFound)
	assert.Contains(t, w.Body.String(), "NOT_FOUND")
}

func TestHandleError_TimeoutError(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api", nil)

	eh.HandleError(c, errors.New("request timeout"), http.StatusRequestTimeout)
	assert.Contains(t, w.Body.String(), "TIMEOUT")
	assert.Contains(t, w.Body.String(), "retry_after")
}

func TestHandleError_WithRequestIDHeader(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api", nil)
	c.Request.Header.Set("X-Request-ID", "req-123")

	eh.HandleError(c, errors.New("test error"), http.StatusBadRequest)
	assert.Contains(t, w.Body.String(), "req-123")
}

func TestHandleError_WithStackTrace(t *testing.T) {
	cfg := &ErrorConfig{
		Environment:       "development",
		IncludeStackTrace: true,
		LogLevel:          "error",
		RequestIDHeader:   "X-Request-ID",
	}
	eh, _ := newTestErrorHandler(cfg)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api", nil)

	eh.HandleError(c, errors.New("debug error"), http.StatusInternalServerError)
	assert.Contains(t, w.Body.String(), "debug error")
}

func TestIsRetryable(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	assert.False(t, eh.isRetryable(400, errors.New("bad request")))
	assert.False(t, eh.isRetryable(404, errors.New("not found")))
	assert.True(t, eh.isRetryable(500, errors.New("server error")))
	assert.True(t, eh.isRetryable(503, errors.New("unavailable")))
	assert.True(t, eh.isRetryable(200, errors.New("connection refused")))
	assert.True(t, eh.isRetryable(200, errors.New("rate limit exceeded")))
	assert.False(t, eh.isRetryable(200, errors.New("normal success")))
}

func TestSetErrorHeaders_WithRateLimit(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api", nil)
	resp := &ErrorResponse{RateLimit: &RateLimitInfo{Limit: 100, Remaining: 0, RetryAfter: 60}}

	eh.setErrorHeaders(c, resp)
	assert.Equal(t, "100", w.Header().Get("X-RateLimit-Limit"))
	assert.Equal(t, "60", w.Header().Get("Retry-After"))
	assert.Equal(t, "no-store, no-cache, must-revalidate", w.Header().Get("Cache-Control"))
}

func TestSetErrorHeaders_WithRetryAfter(t *testing.T) {
	eh, _ := newTestErrorHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api", nil)
	resp := &ErrorResponse{RetryAfter: 5}

	eh.setErrorHeaders(c, resp)
	assert.Equal(t, "5", w.Header().Get("Retry-After"))
}

func TestErrorCodeMap_ContainsAllErrors(t *testing.T) {
	allErrors := []error{
		ErrInvalidRequest, ErrUnauthorized, ErrForbidden, ErrNotFound,
		ErrConflict, ErrTooManyRequests, ErrInternalServer, ErrTimeout,
		ErrInsufficientFunds, ErrFraudDetected, ErrAccountLocked,
	}
	for _, e := range allErrors {
		_, exists := ErrorCodeMap[e]
		assert.True(t, exists, fmt.Sprintf("ErrorCodeMap missing: %v", e))
	}
}

