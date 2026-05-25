package billing

import (
	"fmt"
	"github.com/aegis-aml/aegis/internal/domain"
)

var allPlans []domain.Plan

func init() {
	allPlans = append(allPlans, apiPlans()...)
	allPlans = append(allPlans, dashboardPlans()...)
	allPlans = append(allPlans, sdkPlans()...)
	allPlans = append(allPlans, iframePlans()...)
	allPlans = append(allPlans, datasetPlans()...)
}

func AllPlans() []domain.Plan {
	return allPlans
}

func GetPlansForProduct(product domain.Product) []domain.Plan {
	var plans []domain.Plan
	for _, p := range allPlans {
		if p.Product == product {
			plans = append(plans, p)
		}
	}
	return plans
}

func GetPlanByID(planID string) (domain.Plan, error) {
	for _, p := range allPlans {
		if p.ID == planID {
			return p, nil
		}
	}
	return domain.Plan{}, fmt.Errorf("plan not found: %s", planID)
}
