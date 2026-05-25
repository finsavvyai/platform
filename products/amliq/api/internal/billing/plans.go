package billing

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type PlanRegistry struct {
	plans map[domain.PlanTier]domain.Plan
}

func NewPlanRegistry() *PlanRegistry {
	registry := &PlanRegistry{
		plans: make(map[domain.PlanTier]domain.Plan),
	}
	starterPlan, _ := domain.NewPlan("plan_starter", domain.ProductAPI,
		string(domain.TierStarter), "Starter", 0)
	proPlan, _ := domain.NewPlan("plan_professional", domain.ProductAPI,
		string(domain.TierProfessional), "Professional", 0)
	entPlan, _ := domain.NewPlan("plan_enterprise", domain.ProductAPI,
		string(domain.TierEnterprise), "Enterprise", 0)

	registry.plans[domain.TierStarter] = starterPlan
	registry.plans[domain.TierProfessional] = proPlan
	registry.plans[domain.TierEnterprise] = entPlan

	return registry
}

func (pr *PlanRegistry) GetPlan(tier domain.PlanTier) *domain.Plan {
	if plan, ok := pr.plans[tier]; ok {
		return &plan
	}
	return nil
}

func (pr *PlanRegistry) ListPlans() []domain.Plan {
	plans := make([]domain.Plan, 0, len(pr.plans))
	for _, plan := range pr.plans {
		plans = append(plans, plan)
	}
	return plans
}

func (pr *PlanRegistry) GetPlanByID(planID string) *domain.Plan {
	for _, plan := range pr.plans {
		if plan.ID == planID {
			return &plan
		}
	}
	return nil
}
