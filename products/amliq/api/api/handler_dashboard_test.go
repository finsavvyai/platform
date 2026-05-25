package api

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubCaseQueryRepo struct {
	counts map[string]int
}

func (s *stubCaseQueryRepo) ListByTenant(_ context.Context, _ domain.TenantID, _ string, _ int) ([]domain.ComplianceCase, error) {
	return nil, nil
}
func (s *stubCaseQueryRepo) CountByStatus(_ context.Context, _ domain.TenantID) (map[string]int, error) {
	return s.counts, nil
}

type stubTxnAlertRepo struct {
	counts map[string]int
}

func (s *stubTxnAlertRepo) Create(_ context.Context, a domain.TxnAlert) error { return nil }
func (s *stubTxnAlertRepo) ListByTenant(_ context.Context, _ domain.TenantID, _ int) ([]domain.TxnAlert, error) {
	return nil, nil
}
func (s *stubTxnAlertRepo) CountByType(_ context.Context, _ domain.TenantID) (map[string]int, error) {
	return s.counts, nil
}

func TestDashboardComplianceStats(t *testing.T) {
	h := NewDashboardHandler(
		&stubCaseQueryRepo{counts: map[string]int{"open": 3, "in_review": 2}},
		&stubMonitorRepo{monitors: []domain.OngoingMonitor{
			{Status: domain.MonitorActive},
			{Status: domain.MonitorPaused},
		}},
		&stubMediaRepo{},
		&stubTxnAlertRepo{counts: map[string]int{"high_value": 5}},
	)
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
			req := newTenantRequest("GET", "/api/v1/dashboard/compliance", tt.tenantID)
			rr := httptest.NewRecorder()
			h.ComplianceStats(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
			if tt.wantStatus == 200 {
				var body map[string]interface{}
				json.NewDecoder(rr.Body).Decode(&body)
				data := body["data"].(map[string]interface{})
				if data["openCases"].(float64) != 5 {
					t.Errorf("openCases = %v, want 5", data["openCases"])
				}
			}
		})
	}
}
