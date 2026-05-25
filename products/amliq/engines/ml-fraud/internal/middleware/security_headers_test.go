package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestSecurityHeadersGin_SetsAllHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(SecurityHeadersGin())
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	for key, expected := range SecurityHeaders {
		assert.Equal(t, expected, w.Header().Get(key), "header %s", key)
	}
}

func TestSecurityHeadersGin_OptionsRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(SecurityHeadersGin())
	router.OPTIONS("/test", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodOptions, "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	for key, expected := range SecurityHeaders {
		assert.Equal(t, expected, w.Header().Get(key), "header %s", key)
	}
}

func TestSecurityHeadersChi_SetsAllHeaders(t *testing.T) {
	handler := SecurityHeadersChi(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	for key, expected := range SecurityHeaders {
		assert.Equal(t, expected, w.Header().Get(key), "header %s", key)
	}
}

func TestSecurityHeadersChi_OptionsRequest(t *testing.T) {
	handler := SecurityHeadersChi(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	for key, expected := range SecurityHeaders {
		assert.Equal(t, expected, w.Header().Get(key), "header %s", key)
	}
}
