package billing

import "github.com/aegis-aml/aegis/internal/domain"

func apiPlans() []domain.Plan {
	return []domain.Plan{
		*makePlan("api_starter", domain.ProductAPI, string(domain.TierStarting),
			"API Startup", 99900, domain.MetricAPIScreenings, 10000,
			[]string{"L1-L4 matching", "5 core lists", "email support"}),
		*makePlan("api_pro", domain.ProductAPI, string(domain.TierProfessional),
			"API Professional", 499900, domain.MetricAPIScreenings, 250000,
			[]string{"L1-L6 matching", "all lists", "PEP+sanctions",
				"priority support", "webhooks", "SLA 99.9%"}),
		*makePlan("api_ent", domain.ProductAPI, string(domain.TierEnterprise),
			"API Enterprise", 0, domain.MetricAPIScreenings, 999999999,
			[]string{"unlimited screening", "graph matching",
				"dedicated account manager", "custom SLA",
				"on-premise option", "SOC 2 report"}),
	}
}

func sdkPlans() []domain.Plan {
	return []domain.Plan{
		*makePlan("sdk_starter", domain.ProductSDK, string(domain.TierStarting),
			"SDK Startup", 199900, domain.MetricSDKCalls, 50000,
			[]string{"Go + Python", "1 environment", "weekly updates"}),
		*makePlan("sdk_pro", domain.ProductSDK, string(domain.TierProfessional),
			"SDK Professional", 599900, domain.MetricSDKCalls, 500000,
			[]string{"all SDKs", "3 environments", "daily updates",
				"priority support"}),
		*makePlan("sdk_ent", domain.ProductSDK, string(domain.TierEnterprise),
			"SDK Enterprise", 0, domain.MetricSDKCalls, 999999999,
			[]string{"unlimited calls", "on-premise", "hourly updates",
				"custom integration support"}),
	}
}

func makePlan(id string, product domain.Product, tier string, name string,
	price int, metric domain.UsageMetric, limit int64, features []string,
) *domain.Plan {
	plan, _ := domain.NewPlan(id, product, tier, name, price)
	plan.SetLimit(metric, limit)
	plan.Features = features
	return &plan
}
