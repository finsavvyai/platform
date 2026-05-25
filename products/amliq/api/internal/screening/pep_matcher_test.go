package screening

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type mockPEPRepo struct {
	profiles map[string]*domain.PEPProfile
}

func (m *mockPEPRepo) GetByEntityID(
	_ context.Context, entityID string,
) (*domain.PEPProfile, error) {
	if p, ok := m.profiles[entityID]; ok {
		return p, nil
	}
	return nil, nil
}

func TestPEPMatcherScreen(t *testing.T) {
	profile := domain.NewPEPProfile("ent_000000000002", domain.PEPTier1, "President", "RU")
	repo := &mockPEPRepo{profiles: map[string]*domain.PEPProfile{
		"ent_000000000002": &profile,
	}}
	engine := NewEngine(nil)
	matcher := NewPEPMatcher(repo, engine)

	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	query := makeTestEntity(t, "ent_000000000001", "Vladimir Putin")
	cand := makeTestEntity(t, "ent_000000000002", "Vladimir Putin")
	cand.ListID = "pep_opensanctions"

	results, err := matcher.Screen(
		context.Background(), tenantID, query, []domain.Entity{cand}, nil,
	)
	if err != nil {
		t.Fatalf("Screen error: %v", err)
	}
	if len(results) == 0 {
		t.Fatal("expected at least 1 result")
	}
	if !results[0].IsPEP {
		t.Error("expected IsPEP=true")
	}
	if results[0].Profile.Tier != domain.PEPTier1 {
		t.Errorf("expected Tier1, got %v", results[0].Profile.Tier)
	}
	if results[0].RiskWeight != 1.0 {
		t.Errorf("active Tier1 should have weight 1.0, got %v", results[0].RiskWeight)
	}
}

func TestPEPRiskWeightDecay(t *testing.T) {
	profile := domain.NewPEPProfile("ent_1", domain.PEPTier1, "Former PM", "UK")
	profile.IsActive = false
	profile.ActiveTo = "2015-01-01"

	repo := &mockPEPRepo{}
	matcher := NewPEPMatcher(repo, NewEngine(nil))

	weight := matcher.calcRiskWeight(&profile)
	if weight >= 1.0 {
		t.Errorf("former PEP from 2015 should have decayed weight, got %v", weight)
	}
	if weight <= 0 {
		t.Errorf("weight should still be positive, got %v", weight)
	}
}
