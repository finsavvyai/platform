package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleBillingUsage(t *testing.T) {
	tests := []struct {
		name       string
		url        string
		tenantID   string
		wantStatus int
	}{
		{
			name:       "no_tenant_unauthorized",
			url:        "/api/v1/billing/usage",
			tenantID:   "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid_tenant",
			url:        "/api/v1/billing/usage",
			tenantID:   "bad",
			wantStatus: http.StatusBadRequest,
		},
	}

	handler := handleBillingUsage(nil)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.url, nil)
			if tt.tenantID != "" {
				ctx := context.WithValue(req.Context(), TenantContextKey, tt.tenantID)
				req = req.WithContext(ctx)
			}
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}
