package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBillingSubscriptionsNoTenant(t *testing.T) {
	handler := handleBillingSubscriptions(nil)

	req := httptest.NewRequest("GET", "/api/v1/billing/subscriptions", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status=%d, want 400", w.Code)
	}
}

func TestBillingInvoicesNoTenant(t *testing.T) {
	handler := handleBillingInvoices(nil)

	req := httptest.NewRequest("GET", "/api/v1/billing/invoices", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status=%d, want 400", w.Code)
	}
}

func TestBillingCheckoutNoTenant(t *testing.T) {
	handler := handleCheckout(nil)

	body := strings.NewReader(`{"plan_id":"plan_starter","email":"a@b.com"}`)
	req := httptest.NewRequest("POST", "/api/v1/billing/checkout", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status=%d, want 400", w.Code)
	}
}

func TestBillingCheckoutWithTenant(t *testing.T) {
	handler := handleCheckout(nil)

	body := strings.NewReader(`{"plan_id":"plan_starter","email":"a@b.com"}`)
	req := httptest.NewRequest("POST", "/api/v1/billing/checkout", body)
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), TenantContextKey, "tenant_123")
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// nil service => internal error or panic-guard
	if w.Code == http.StatusOK {
		t.Errorf("Status=%d, expected non-200 with nil service", w.Code)
	}
}
