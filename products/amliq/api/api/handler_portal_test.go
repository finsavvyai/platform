package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPortalHandlerGeneratePortalURL(t *testing.T) {
	handler := NewPortalHandler()

	req := httptest.NewRequest("POST", "/api/v1/billing/portal", nil)
	req.Header.Set("X-Tenant-ID", "tnt_aabbccddeeff")
	w := httptest.NewRecorder()

	handler.GeneratePortalURL(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestPortalHandlerGeneratePortalURLNoTenant(t *testing.T) {
	handler := NewPortalHandler()

	req := httptest.NewRequest("POST", "/api/v1/billing/portal", nil)
	w := httptest.NewRecorder()

	handler.GeneratePortalURL(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
