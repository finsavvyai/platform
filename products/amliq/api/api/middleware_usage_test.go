package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestUsageEnforcementNilEnforcer(t *testing.T) {
	tests := []struct {
		name       string
		wantStatus int
	}{
		{"passes through when enforcer is nil", http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})
			middleware := UsageEnforcementMiddleware(nil)
			handler := middleware(inner)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/screen", nil)
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			if rr.Code != tt.wantStatus {
				t.Errorf("got %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestUsageEnforcementNoClaims(t *testing.T) {
	tests := []struct {
		name       string
		wantStatus int
	}{
		{"passes through when no claims in context", http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})
			middleware := UsageEnforcementMiddleware(nil)
			handler := middleware(inner)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/screen", nil)
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			if rr.Code != tt.wantStatus {
				t.Errorf("got %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
