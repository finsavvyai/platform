package api

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type stubPEPRepo struct {
	profile  *domain.PEPProfile
	profiles []domain.PEPProfile
	err      error
}

func (s *stubPEPRepo) Create(_ context.Context, p domain.PEPProfile) error { return s.err }
func (s *stubPEPRepo) GetByEntityID(_ context.Context, id string) (*domain.PEPProfile, error) {
	return s.profile, s.err
}
func (s *stubPEPRepo) ListByCountry(_ context.Context, c string, limit int) ([]domain.PEPProfile, error) {
	return s.profiles, s.err
}
func (s *stubPEPRepo) SearchByName(_ context.Context, _ string, _ int) ([]storage.PEPSearchResult, error) {
	return nil, s.err
}

func TestPEPScreen(t *testing.T) {
	p := domain.NewPEPProfile("ent_1", domain.PEPTier1, "President", "US")
	h := NewPEPHandler(&stubPEPRepo{profile: &p})
	tests := []struct {
		name       string
		body       string
		wantStatus int
	}{
		{"by entity_id", `{"entity_id":"ent_1"}`, 200},
		{"by name only", `{"name":"John"}`, 200},
		{"missing both", `{}`, 400},
		{"bad json", `{bad`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/v1/pep/screen",
				strings.NewReader(tt.body))
			rr := httptest.NewRecorder()
			h.Screen(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestPEPListByCountry(t *testing.T) {
	h := NewPEPHandler(&stubPEPRepo{profiles: []domain.PEPProfile{}})
	tests := []struct {
		name       string
		country    string
		wantStatus int
	}{
		{"valid country", "US", 200},
		{"empty country", "", 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/pep?country="+tt.country, nil)
			rr := httptest.NewRecorder()
			h.ListByCountry(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
