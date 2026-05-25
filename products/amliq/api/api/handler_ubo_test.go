package api

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubUBORepo struct {
	owners []domain.BeneficialOwner
	err    error
}

func (s *stubUBORepo) Create(_ context.Context, o domain.BeneficialOwner) error { return s.err }
func (s *stubUBORepo) ListByOrg(_ context.Context, orgID string) ([]domain.BeneficialOwner, error) {
	return s.owners, s.err
}
func (s *stubUBORepo) Update(_ context.Context, o domain.BeneficialOwner) error { return s.err }
func (s *stubUBORepo) GetByID(_ context.Context, id string) (domain.BeneficialOwner, error) {
	for _, o := range s.owners {
		if o.ID == id {
			return o, nil
		}
	}
	return domain.BeneficialOwner{}, errors.New("not found")
}
func (s *stubUBORepo) Delete(_ context.Context, id string) error { return s.err }

func TestUBOAddOwner(t *testing.T) {
	h := NewUBOHandler(&stubUBORepo{})
	tests := []struct {
		name       string
		tenantID   string
		body       string
		wantStatus int
	}{
		{"valid", "tnt_abcdefghijkl",
			`{"organization_id":"org_1","owner_name":"Jane","nationality":"US","ownership_pct":25.5,"is_direct_owner":true}`,
			201},
		{"no tenant", "", `{"organization_id":"org_1","owner_name":"Jane","nationality":"US","ownership_pct":25.5}`, 401},
		{"bad json", "tnt_abcdefghijkl", `{bad`, 400},
		{"invalid pct", "tnt_abcdefghijkl",
			`{"organization_id":"org_1","owner_name":"Jane","nationality":"US","ownership_pct":150}`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("POST", "/api/v1/ubo", tt.tenantID)
			req.Body = httptest.NewRequest("POST", "/", strings.NewReader(tt.body)).Body
			rr := httptest.NewRecorder()
			h.AddOwner(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestUBOListByOrg(t *testing.T) {
	h := NewUBOHandler(&stubUBORepo{owners: []domain.BeneficialOwner{}})
	tests := []struct {
		name       string
		orgID      string
		wantStatus int
	}{
		{"valid org", "org_1", 200},
		{"empty org", "", 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/ubo/org/"+tt.orgID, nil)
			req.SetPathValue("id", tt.orgID)
			rr := httptest.NewRecorder()
			h.ListByOrg(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestUBODeleteOwner(t *testing.T) {
	tests := []struct {
		name       string
		ownerID    string
		err        error
		wantStatus int
	}{
		{"success", "ubo_123", nil, 200},
		{"missing id", "", nil, 400},
		{"db error", "ubo_456", errors.New("fail"), 500},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewUBOHandler(&stubUBORepo{err: tt.err})
			req := httptest.NewRequest("DELETE", "/api/v1/ubo/"+tt.ownerID, nil)
			req.SetPathValue("owner_id", tt.ownerID)
			rr := httptest.NewRecorder()
			h.DeleteOwner(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
