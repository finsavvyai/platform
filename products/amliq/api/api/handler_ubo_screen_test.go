package api

import (
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type stubScreeningRepo struct {
	results storage.ScreeningRepository
	err     error
}

func TestUBOScreenChain(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_test")
	owner1, _ := domain.NewBeneficialOwner(tid, "org_1", "John Doe", "US", 30.5, true)
	owner2, _ := domain.NewBeneficialOwner(tid, "org_1", "Jane Smith", "CA", 25.0, false)
	owners := []domain.BeneficialOwner{owner1, owner2}
	repo := &stubUBORepo{owners: owners}
	h := NewUBOScreenHandler(repo, nil)
	tests := []struct {
		name       string
		orgID      string
		wantStatus int
	}{
		{"valid org", "org_1", 200},
		{"missing org", "", 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/v1/ubo/"+tt.orgID+"/screen", nil)
			req.SetPathValue("id", tt.orgID)
			rr := httptest.NewRecorder()
			h.ScreenChain(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func BenchmarkUBOScreenChain(b *testing.B) {
	tid, _ := domain.NewTenantID("tnt_test")
	var owners []domain.BeneficialOwner
	for i := 0; i < 100; i++ {
		o, _ := domain.NewBeneficialOwner(tid, "org_bench", "Owner Name", "US", float64(i%100), true)
		owners = append(owners, o)
	}
	repo := &stubUBORepo{owners: owners}
	h := NewUBOScreenHandler(repo, nil)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("POST", "/api/v1/ubo/org_bench/screen", nil)
		req.SetPathValue("id", "org_bench")
		rr := httptest.NewRecorder()
		h.ScreenChain(rr, req)
	}
}
