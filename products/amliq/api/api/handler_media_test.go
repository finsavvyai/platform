package api

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubMediaRepo struct {
	hits []domain.AdverseMediaHit
	err  error
}

func (s *stubMediaRepo) Create(_ context.Context, h domain.AdverseMediaHit) error { return s.err }
func (s *stubMediaRepo) ListByEntity(_ context.Context, id string) ([]domain.AdverseMediaHit, error) {
	return s.hits, s.err
}
func (s *stubMediaRepo) ListUnreviewed(_ context.Context, tid domain.TenantID, limit int) ([]domain.AdverseMediaHit, error) {
	return s.hits, s.err
}

func TestMediaGetByEntity(t *testing.T) {
	h := NewMediaHandler(&stubMediaRepo{hits: []domain.AdverseMediaHit{}})
	tests := []struct {
		name       string
		entityID   string
		wantStatus int
	}{
		{"valid entity", "ent_1", 200},
		{"empty entity", "", 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/media/entity/"+tt.entityID, nil)
			req.SetPathValue("id", tt.entityID)
			rr := httptest.NewRecorder()
			h.GetByEntity(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
