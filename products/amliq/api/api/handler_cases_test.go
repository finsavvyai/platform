package api

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubCaseRepo struct {
	cases []*domain.ComplianceCase
	err   error
}

func (s *stubCaseRepo) Create(_ context.Context, c domain.ComplianceCase) error { return s.err }
func (s *stubCaseRepo) GetByID(_ context.Context, id string) (*domain.ComplianceCase, error) {
	for _, c := range s.cases {
		if c.ID == id {
			return c, nil
		}
	}
	return nil, s.err
}
func (s *stubCaseRepo) Update(_ context.Context, c domain.ComplianceCase) error { return s.err }
func (s *stubCaseRepo) UpdateStatus(_ context.Context, _, _ string) error       { return s.err }

type stubCommentRepo struct{}

func (s *stubCommentRepo) Create(_ context.Context, c domain.CaseComment) error { return nil }
func (s *stubCommentRepo) ListByCaseID(_ context.Context, id string) ([]domain.CaseComment, error) {
	return nil, nil
}

func TestListCases(t *testing.T) {
	tests := []struct {
		name       string
		tenantID   string
		wantStatus int
	}{
		{"with tenant", "tnt_abcdefghijkl", 200},
		{"no tenant", "", 401},
	}
	h := NewCaseHandler(&stubCaseRepo{}, &stubCaseQueryRepo{}, &stubCommentRepo{})
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("GET", "/api/v1/cases", tt.tenantID)
			rr := httptest.NewRecorder()
			h.ListCases(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestGetCase(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abcdefghijkl")
	c, _ := domain.NewComplianceCase(tid, "scr_1", "John", "JD", "OFAC", 0.85)
	repo := &stubCaseRepo{cases: []*domain.ComplianceCase{&c}}
	h := NewCaseHandler(repo, &stubCaseQueryRepo{}, &stubCommentRepo{})

	tests := []struct {
		name       string
		caseID     string
		wantStatus int
	}{
		{"found", c.ID, 200},
		{"not found", "nonexistent", 404},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("GET", "/api/v1/cases/"+tt.caseID, "tnt_abcdefghijkl")
			req.SetPathValue("id", tt.caseID)
			rr := httptest.NewRecorder()
			h.GetCase(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
