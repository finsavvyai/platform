package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBodyLimitChi_AcceptsSmallBody(t *testing.T) {
	handler := BodyLimitChi(1024)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(`{"ok":true}`))
	req.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestBodyLimitChi_RejectsByContentLength(t *testing.T) {
	handler := BodyLimitChi(8)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	w := httptest.NewRecorder()
	body := strings.NewReader(`{"very":"large payload that exceeds the limit"}`)
	req := httptest.NewRequest(http.MethodPost, "/test", body)
	req.Header.Set("Content-Type", "application/json")
	req.ContentLength = int64(body.Len())
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}

func TestBodyLimitChi_MaxBytesReaderEnforced(t *testing.T) {
	handler := BodyLimitChi(8)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	w := httptest.NewRecorder()
	// Content-Length is not set so MaxBytesReader kicks in during read
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(`{"very":"large payload"}`))
	req.ContentLength = -1
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}

func TestBodyLimitChi_ZeroLimitDisabled(t *testing.T) {
	handler := BodyLimitChi(0)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(`{"big":"body"}`))
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}
