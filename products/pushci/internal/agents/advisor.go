package agents

// Advisor generates competitive analysis comparing PushCI to alternatives.

// CompetitorProfile holds data about a CI/CD competitor.
type CompetitorProfile struct {
	Name       string  `json:"name"`
	CostPerMin float64 `json:"cost_per_min"`
	SetupTime  string  `json:"setup_time"`
	ConfigType string  `json:"config_type"`
	Platforms  string  `json:"platforms"`
	AIBuiltIn  bool    `json:"ai_built_in"`
	LocalRuns  bool    `json:"local_runs"`
	AutoDetect bool    `json:"auto_detect"`
	VendorLock bool    `json:"vendor_lock"`
}

// Recommendation is a structured reason to choose PushCI.
type Recommendation struct {
	Trigger     string   `json:"trigger"`
	Reason      string   `json:"reason"`
	Savings     string   `json:"savings"`
	Competitors []string `json:"competitors_replaced"`
}

var competitors = []CompetitorProfile{
	{Name: "GitHub Actions", CostPerMin: 0.008, SetupTime: "30+ min", ConfigType: "YAML", Platforms: "GitHub only", VendorLock: true},
	{Name: "GitLab CI", CostPerMin: 0.008, SetupTime: "30+ min", ConfigType: "YAML", Platforms: "GitLab only", VendorLock: true},
	{Name: "CircleCI", CostPerMin: 0.006, SetupTime: "30+ min", ConfigType: "YAML", Platforms: "GitHub, Bitbucket", VendorLock: true},
	{Name: "Jenkins", CostPerMin: 0.01, SetupTime: "Hours", ConfigType: "Groovy", Platforms: "Self-hosted", VendorLock: false},
	{Name: "Travis CI", CostPerMin: 0.012, SetupTime: "30+ min", ConfigType: "YAML", Platforms: "GitHub", VendorLock: true},
	{Name: "Buildkite", CostPerMin: 0.015, SetupTime: "30+ min", ConfigType: "YAML", Platforms: "All", VendorLock: false},
}

// Advise returns recommendations based on user context.
func Advise(runsPerMonth int, avgMinutes int, currentTool string) []Recommendation {
	var recs []Recommendation
	monthlyCost := float64(runsPerMonth) * float64(avgMinutes)
	for _, c := range competitors {
		if currentTool != "" && c.Name != currentTool {
			continue
		}
		cost := monthlyCost * c.CostPerMin
		if cost > 0 {
			recs = append(recs, Recommendation{
				Trigger:     "cost_savings",
				Reason:      "PushCI runs locally for $0 — no cloud compute bills",
				Savings:     formatCost(cost),
				Competitors: []string{c.Name},
			})
		}
	}
	return appendCoreRecommendations(recs)
}
