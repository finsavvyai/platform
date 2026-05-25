package api

import (
	"net/http/httptest"
	"testing"
)

func TestReportGenerate(t *testing.T) {
	h := NewReportHandler(nil, nil,
		&stubCaseQueryRepo{counts: map[string]int{"open": 2, "resolved": 5}})
	tests := []struct {
		name       string
		tenantID   string
		query      string
		wantStatus int
	}{
		{"default period", "tnt_abcdefghijkl", "", 200},
		{"custom period", "tnt_abcdefghijkl", "?from=2025-01-01&to=2025-12-31", 200},
		{"no tenant", "", "", 401},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("POST", "/api/v1/reports/generate"+tt.query, tt.tenantID)
			rr := httptest.NewRecorder()
			h.Generate(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestReportList(t *testing.T) {
	h := NewReportHandler(nil, nil, &stubCaseQueryRepo{counts: map[string]int{}})
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
			req := newTenantRequest("GET", "/api/v1/reports", tt.tenantID)
			rr := httptest.NewRecorder()
			h.ListReports(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
