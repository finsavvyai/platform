package api

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubProfileRepo struct {
	profiles []domain.MonitorProfile
	err      error
}

func (s *stubProfileRepo) Create(_ context.Context, _ domain.MonitorProfile) error {
	return s.err
}
func (s *stubProfileRepo) GetByID(_ context.Context, _ string) (*domain.MonitorProfile, error) {
	if len(s.profiles) > 0 {
		return &s.profiles[0], s.err
	}
	return nil, s.err
}
func (s *stubProfileRepo) ListByTenant(_ context.Context, _ domain.TenantID) ([]domain.MonitorProfile, error) {
	return s.profiles, s.err
}
func (s *stubProfileRepo) ListDue(_ context.Context, _ int64, _ int) ([]domain.MonitorProfile, error) {
	return nil, s.err
}
func (s *stubProfileRepo) Update(_ context.Context, _ domain.MonitorProfile) error { return s.err }
func (s *stubProfileRepo) Delete(_ context.Context, _ string) error                { return s.err }

func TestProfileCreate(t *testing.T) {
	h := NewMonitorProfileHandler(&stubProfileRepo{})
	tests := []struct {
		name       string
		tenantID   string
		body       string
		wantStatus int
	}{
		{"valid", "tnt_abcdefghijkl", `{"entity_name":"John","entity_type":"Individual","risk_level":"high"}`, 201},
		{"no tenant", "", `{"entity_name":"John"}`, 401},
		{"bad json", "tnt_abcdefghijkl", `{bad`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("POST", "/api/v1/monitor", tt.tenantID)
			req.Body = httptest.NewRequest("POST", "/", strings.NewReader(tt.body)).Body
			rr := httptest.NewRecorder()
			h.Create(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestProfileList(t *testing.T) {
	h := NewMonitorProfileHandler(&stubProfileRepo{profiles: []domain.MonitorProfile{}})
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
			req := newTenantRequest("GET", "/api/v1/monitor", tt.tenantID)
			rr := httptest.NewRecorder()
			h.List(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
