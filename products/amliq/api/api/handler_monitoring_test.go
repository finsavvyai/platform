package api

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubMonitorRepo struct {
	monitors []domain.OngoingMonitor
	err      error
}

func (s *stubMonitorRepo) Create(_ context.Context, m domain.OngoingMonitor) error { return s.err }
func (s *stubMonitorRepo) ListByTenant(_ context.Context, _ domain.TenantID) ([]domain.OngoingMonitor, error) {
	return s.monitors, s.err
}
func (s *stubMonitorRepo) ListDue(_ context.Context, _ int) ([]domain.OngoingMonitor, error) {
	return nil, s.err
}
func (s *stubMonitorRepo) Delete(_ context.Context, _ string) error            { return s.err }
func (s *stubMonitorRepo) UpdateLastScreened(_ context.Context, _ string) error { return s.err }

func TestMonitorCreate(t *testing.T) {
	h := NewMonitorHandler(&stubMonitorRepo{})
	tests := []struct {
		name       string
		tenantID   string
		body       string
		wantStatus int
	}{
		{"valid", "tnt_abcdefghijkl", `{"entity_name":"John","entity_type":"individual","frequency":"daily"}`, 201},
		{"no tenant", "", `{"entity_name":"John","entity_type":"individual","frequency":"daily"}`, 401},
		{"bad json", "tnt_abcdefghijkl", `{bad`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("POST", "/api/v1/monitors", tt.tenantID)
			req.Body = httptest.NewRequest("POST", "/", strings.NewReader(tt.body)).Body
			rr := httptest.NewRecorder()
			h.Create(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestMonitorList(t *testing.T) {
	h := NewMonitorHandler(&stubMonitorRepo{monitors: []domain.OngoingMonitor{}})
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
			req := newTenantRequest("GET", "/api/v1/monitors", tt.tenantID)
			rr := httptest.NewRecorder()
			h.List(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
