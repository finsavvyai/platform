package api

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestCaseAssignHandler(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abcdefghijkl")
	c, _ := domain.NewComplianceCase(tid, "scr_1", "John", "JD", "OFAC", 0.85)
	repo := &stubCaseRepo{cases: []*domain.ComplianceCase{&c}}
	h := NewCaseActionHandler(repo)

	tests := []struct {
		name       string
		caseID     string
		body       string
		wantStatus int
	}{
		{"assign valid", c.ID, `{"user_id":"user_1"}`, 200},
		{"not found", "bad_id", `{"user_id":"user_1"}`, 404},
		{"missing user", c.ID, `{}`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("PUT", "/api/v1/cases/"+tt.caseID+"/assign", "tnt_abcdefghijkl")
			req.SetPathValue("id", tt.caseID)
			req.Body = httptest.NewRequest("PUT", "/", strings.NewReader(tt.body)).Body
			rr := httptest.NewRecorder()
			h.Assign(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestCaseEscalateHandler(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abcdefghijkl")
	c, _ := domain.NewComplianceCase(tid, "scr_1", "John", "JD", "OFAC", 0.85)
	repo := &stubCaseRepo{cases: []*domain.ComplianceCase{&c}}
	h := NewCaseActionHandler(repo)

	tests := []struct {
		name       string
		caseID     string
		wantStatus int
	}{
		{"escalate valid", c.ID, 200},
		{"not found", "bad_id", 404},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("PUT", "/api/v1/cases/"+tt.caseID+"/escalate", "tnt_abcdefghijkl")
			req.SetPathValue("id", tt.caseID)
			rr := httptest.NewRecorder()
			h.Escalate(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestCaseResolveHandler(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abcdefghijkl")
	c, _ := domain.NewComplianceCase(tid, "scr_1", "John", "JD", "OFAC", 0.85)
	repo := &stubCaseRepo{cases: []*domain.ComplianceCase{&c}}
	h := NewCaseActionHandler(repo)

	req := newTenantRequest("PUT", "/api/v1/cases/"+c.ID+"/resolve", "tnt_abcdefghijkl")
	req.SetPathValue("id", c.ID)
	req.Body = httptest.NewRequest("PUT", "/", strings.NewReader(
		`{"resolution":"confirmed","true_match":true}`)).Body
	rr := httptest.NewRecorder()
	h.Resolve(rr, req)
	if rr.Code != 200 {
		t.Errorf("status = %d, want 200", rr.Code)
	}
}
