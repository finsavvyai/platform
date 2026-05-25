package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

func TestRateLimitMiddleware(t *testing.T) {
	limiter := NewRateLimiter(10, 10)
	middleware := limiter.Middleware()

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware(next)

	tests := []struct {
		name       string
		tenantID   string
		wantStatus int
	}{
		{"allowed", "tnt_test001", http.StatusOK},
		{"missing tenant", "", http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.tenantID != "" {
				ctx := context.WithValue(req.Context(),
					TenantContextKey, tt.tenantID)
				req = req.WithContext(ctx)
			}
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got %d, want %d", w.Code,
					tt.wantStatus)
			}
		})
	}
}

func TestRateLimitHeaders(t *testing.T) {
	limiter := NewRateLimiter(10, 10)
	middleware := limiter.Middleware()

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware(next)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := context.WithValue(req.Context(), TenantContextKey, "tnt_h1")
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if remaining := w.Header().Get("X-RateLimit-Remaining"); remaining == "" {
		t.Error("missing X-RateLimit-Remaining")
	} else {
		val, _ := strconv.Atoi(remaining)
		if val != 9 {
			t.Errorf("remaining: got %d, want 9", val)
		}
	}

	if reset := w.Header().Get("X-RateLimit-Reset"); reset == "" {
		t.Error("missing X-RateLimit-Reset")
	}
}
