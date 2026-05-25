package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/billing"
)

func setupUsageHandler() *UsageHandler {
	svc := billing.NewBillingService(
		nil, &stubSubRepo{}, &stubUsageRepo{},
		&stubInvoiceRepo{}, &stubEventRepo{},
	)
	return NewUsageHandler(*svc)
}

func TestUsageHandler(t *testing.T) {
	handler := setupUsageHandler()
	tests := []struct {
		name       string
		method     string
		path       string
		tenantID   string
		wantStatus int
	}{
		{"get usage ok", "GET", "/api/v1/billing/usage", "tnt_abcdefghijkl", http.StatusOK},
		{"get usage no tenant", "GET", "/api/v1/billing/usage", "", http.StatusBadRequest},
		{"usage history ok", "GET", "/api/v1/billing/usage/history", "tnt_abcdefghijkl", http.StatusOK},
		{"invoices ok", "GET", "/api/v1/billing/invoices", "tnt_abcdefghijkl", http.StatusOK},
		{"invoices no tenant", "GET", "/api/v1/billing/invoices", "", http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			if tt.tenantID != "" {
				req.Header.Set("X-Tenant-ID", tt.tenantID)
			}
			w := httptest.NewRecorder()
			switch tt.path {
			case "/api/v1/billing/usage":
				handler.GetUsage(w, req)
			case "/api/v1/billing/usage/history":
				handler.GetUsageHistory(w, req)
			case "/api/v1/billing/invoices":
				handler.GetInvoices(w, req)
			}
			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}
