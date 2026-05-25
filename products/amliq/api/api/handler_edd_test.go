package api

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubEDDRepo struct {
	report *domain.EDDReport
	err    error
}

func (s *stubEDDRepo) Create(_ context.Context, r domain.EDDReport) error { return s.err }
func (s *stubEDDRepo) GetByID(_ context.Context, id string) (*domain.EDDReport, error) {
	return s.report, s.err
}
func (s *stubEDDRepo) Update(_ context.Context, r domain.EDDReport) error { return s.err }

func TestEDDCreate(t *testing.T) {
	h := NewEDDHandler(&stubEDDRepo{})
	tests := []struct {
		name       string
		tenantID   string
		body       string
		wantStatus int
	}{
		{"valid", "tnt_abcdefghijkl", `{"entity_id":"e1","entity_name":"John","case_id":"c1"}`, 201},
		{"no tenant", "", `{"entity_id":"e1","entity_name":"John","case_id":"c1"}`, 401},
		{"bad json", "tnt_abcdefghijkl", `{bad`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("POST", "/api/v1/edd", tt.tenantID)
			req.Body = httptest.NewRequest("POST", "/", strings.NewReader(tt.body)).Body
			rr := httptest.NewRecorder()
			h.Create(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestEDDGet(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abcdefghijkl")
	report, _ := domain.NewEDDReport(tid, "e1", "John", "c1")
	h := NewEDDHandler(&stubEDDRepo{report: &report})

	tests := []struct {
		name       string
		eddID      string
		wantStatus int
	}{
		{"found", report.ID, 200},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/edd/"+tt.eddID, nil)
			req.SetPathValue("id", tt.eddID)
			rr := httptest.NewRecorder()
			h.Get(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
