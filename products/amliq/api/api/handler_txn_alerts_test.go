package api

import (
	"net/http/httptest"
	"testing"
)

func TestTxnAlertList(t *testing.T) {
	h := NewTxnAlertHandler(&stubTxnAlertRepo{counts: map[string]int{}})
	tests := []struct {
		name       string
		tenantID   string
		wantStatus int
	}{
		{"with tenant", "tnt_abcdefghijkl", 200},
		{"no tenant", "", 401},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("GET", "/api/v1/txn/alerts", tt.tenantID)
			rr := httptest.NewRecorder()
			h.List(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestTxnAlertSummary(t *testing.T) {
	h := NewTxnAlertHandler(&stubTxnAlertRepo{counts: map[string]int{"high_value": 3}})
	tests := []struct {
		name       string
		tenantID   string
		wantStatus int
	}{
		{"with tenant", "tnt_abcdefghijkl", 200},
		{"no tenant", "", 401},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("GET", "/api/v1/txn/alerts/summary", tt.tenantID)
			rr := httptest.NewRecorder()
			h.Summary(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
