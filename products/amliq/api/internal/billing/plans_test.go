package billing

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestNewPlanRegistry(t *testing.T) {
	registry := NewPlanRegistry()
	if registry == nil {
		t.Fatal("NewPlanRegistry() returned nil")
	}
	if len(registry.plans) != 3 {
		t.Errorf("plans count = %d, want 3", len(registry.plans))
	}
}

func TestPlanRegistryGetPlan(t *testing.T) {
	registry := NewPlanRegistry()
	tests := []struct {
		tier      domain.PlanTier
		wantFound bool
	}{
		{domain.TierStarter, true},
		{domain.TierProfessional, true},
		{domain.TierEnterprise, true},
		{domain.PlanTier("invalid"), false},
	}
	for _, tt := range tests {
		t.Run(string(tt.tier), func(t *testing.T) {
			plan := registry.GetPlan(tt.tier)
			if (plan != nil) != tt.wantFound {
				t.Errorf("GetPlan() found = %v, want %v", plan != nil, tt.wantFound)
			}
		})
	}
}

func TestPlanRegistryListPlans(t *testing.T) {
	registry := NewPlanRegistry()
	plans := registry.ListPlans()
	if len(plans) != 3 {
		t.Errorf("ListPlans() count = %d, want 3", len(plans))
	}
}

func TestPlanRegistryGetPlanByID(t *testing.T) {
	registry := NewPlanRegistry()
	plan := registry.GetPlanByID("plan_starter")
	if plan == nil {
		t.Errorf("GetPlanByID('plan_starter') returned nil")
	}
	if plan.Tier != string(domain.TierStarter) {
		t.Errorf("Tier = %v, want %v", plan.Tier, domain.TierStarter)
	}
}

func TestPlanRegistryGetPlanByIDNotFound(t *testing.T) {
	registry := NewPlanRegistry()
	plan := registry.GetPlanByID("nonexistent")
	if plan != nil {
		t.Errorf("GetPlanByID('nonexistent') returned %v, want nil", plan)
	}
}
