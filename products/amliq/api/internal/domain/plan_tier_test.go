package domain

import "testing"

func TestParsePlanTier(t *testing.T) {
	tests := []struct {
		input string
		want  PlanTier
		err   bool
	}{
		{"starter", TierStarter, false},
		{"Starter", TierStarter, false},
		{"professional", TierProfessional, false},
		{"enterprise", TierEnterprise, false},
		{"invalid", "", true},
	}
	for _, tt := range tests {
		tier, err := ParsePlanTier(tt.input)
		if (err != nil) != tt.err || tier != tt.want {
			t.Errorf("ParsePlanTier(%s) = %v, %v", tt.input, tier, err)
		}
	}
}

func TestDisplayName(t *testing.T) {
	if TierStarter.DisplayName() != "Starter" {
		t.Errorf("Starter DisplayName wrong")
	}
}

func TestScreeningLimit(t *testing.T) {
	if TierStarter.ScreeningLimit() != 10000 {
		t.Errorf("ScreeningLimit wrong")
	}
	if TierProfessional.ScreeningLimit() != 100000 {
		t.Errorf("ScreeningLimit wrong")
	}
	if TierEnterprise.ScreeningLimit() != 999999999 {
		t.Errorf("ScreeningLimit wrong")
	}
}

func TestTenantLimit(t *testing.T) {
	if TierStarter.TenantLimit() != 1 {
		t.Errorf("TenantLimit wrong")
	}
	if TierProfessional.TenantLimit() != 5 {
		t.Errorf("TenantLimit wrong")
	}
	if TierEnterprise.TenantLimit() != 999999999 {
		t.Errorf("TenantLimit wrong")
	}
}

func TestMaxMatchingLayer(t *testing.T) {
	if TierStarter.MaxMatchingLayer() != 2 {
		t.Errorf("MaxMatchingLayer wrong")
	}
	if TierProfessional.MaxMatchingLayer() != 5 {
		t.Errorf("MaxMatchingLayer wrong")
	}
	if TierEnterprise.MaxMatchingLayer() != 6 {
		t.Errorf("MaxMatchingLayer wrong")
	}
}

func TestIsValid(t *testing.T) {
	if !TierStarter.IsValid() || !TierProfessional.IsValid() || !TierEnterprise.IsValid() {
		t.Errorf("IsValid wrong")
	}
	if PlanTier("invalid").IsValid() {
		t.Errorf("IsValid should reject invalid")
	}
}
