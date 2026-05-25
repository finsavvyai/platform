package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimitExceeded(t *testing.T) {
	limiter := NewRateLimiter(2, 2)
	middleware := limiter.Middleware()

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware(next)
	tenantID := "tnt_exceed_test"

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		ctx := context.WithValue(req.Context(), TenantContextKey,
			tenantID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("req %d: got %d", i+1, w.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := context.WithValue(req.Context(), TenantContextKey, tenantID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("exceeded: got %d, want 429", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Error("missing Retry-After")
	}
}

func TestRateLimitPerTenant(t *testing.T) {
	limiter := NewRateLimiter(1, 1)
	middleware := limiter.Middleware()

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware(next)

	for _, tenant := range []string{"tnt_one", "tnt_two"} {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		ctx := context.WithValue(req.Context(), TenantContextKey,
			tenant)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("tenant %s: got %d", tenant, w.Code)
		}
	}
}

func TestRateLimitRefill(t *testing.T) {
	limiter := NewRateLimiter(2, 1)
	handler := limiter.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	mk := func() (*httptest.ResponseRecorder, *http.Request) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		ctx := context.WithValue(req.Context(), TenantContextKey, "tnt_refill")
		return httptest.NewRecorder(), req.WithContext(ctx)
	}
	w, r := mk()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("first: got %d", w.Code)
	}
	w2, r2 := mk()
	handler.ServeHTTP(w2, r2)
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("second: got %d", w2.Code)
	}
	time.Sleep(600 * time.Millisecond)
	w3, r3 := mk()
	handler.ServeHTTP(w3, r3)
	if w3.Code != http.StatusOK {
		t.Errorf("after refill: got %d", w3.Code)
	}
}
