package billing

import "github.com/aegis-aml/aegis/internal/domain"

func dashboardPlans() []domain.Plan {
	return []domain.Plan{
		*makePlan("dash_base", domain.ProductDashboard, string(domain.TierBasic),
			"Dashboard Startup", 79900, domain.MetricDashboardSeats, 3,
			[]string{"3 included seats", "$99/seat extra",
				"alert queue", "basic analytics"}),
		*makePlan("dash_pro", domain.ProductDashboard, string(domain.TierProfessional),
			"Dashboard Professional", 299900, domain.MetricDashboardSeats, 15,
			[]string{"15 seats", "$79/seat extra", "advanced analytics",
				"custom branding", "audit trail export"}),
		*makePlan("dash_ent", domain.ProductDashboard, string(domain.TierEnterprise),
			"Dashboard Enterprise", 0, domain.MetricDashboardSeats, 999999,
			[]string{"unlimited seats", "SSO/SAML", "role-based access",
				"custom workflows"}),
	}
}

func iframePlans() []domain.Plan {
	return []domain.Plan{
		*makePlan("iframe_basic", domain.ProductIFrame, string(domain.TierBasic),
			"iFrame Startup", 49900, domain.MetricIFrameLookups, 10000,
			[]string{"1 domain", "10K lookups", "basic styling"}),
		*makePlan("iframe_pro", domain.ProductIFrame, string(domain.TierProfessional),
			"iFrame Professional", 199900, domain.MetricIFrameLookups, 100000,
			[]string{"5 domains", "100K lookups", "full white-label",
				"custom CSS"}),
		*makePlan("iframe_ent", domain.ProductIFrame, string(domain.TierEnterprise),
			"iFrame Enterprise", 0, domain.MetricIFrameLookups, 999999999,
			[]string{"unlimited domains", "dedicated support",
				"custom integration"}),
	}
}

func datasetPlans() []domain.Plan {
	std, _ := domain.NewPlan("dataset_std", domain.ProductDataset,
		string(domain.TierStandard), "Dataset Standard", 199900)
	std.SetLimit(domain.MetricDatasetFetches, 200)
	std.SetLimit(domain.MetricDatasetRows, 10000000)
	std.Features = []string{"daily CSV/JSON", "public sanctions lists",
		"basic entity fields"}

	prem, _ := domain.NewPlan("dataset_prem", domain.ProductDataset,
		string(domain.TierPremium), "Dataset Premium", 499900)
	prem.SetLimit(domain.MetricDatasetFetches, 1000)
	prem.SetLimit(domain.MetricDatasetRows, 50000000)
	prem.Features = []string{"hourly updates", "PEP + sanctions",
		"delta feed", "rich entity metadata"}

	ent, _ := domain.NewPlan("dataset_ent", domain.ProductDataset,
		string(domain.TierEnterprise), "Dataset Enterprise", 0)
	ent.SetLimit(domain.MetricDatasetFetches, 999999999)
	ent.SetLimit(domain.MetricDatasetRows, 999999999)
	ent.Features = []string{"real-time streaming", "custom lists",
		"webhook delivery", "SLA guarantee"}

	return []domain.Plan{std, prem, ent}
}
