// Package marketing is the single source of truth for AMLIQ's
// public-facing claims (list count, entity count, latency target,
// pricing). Landing copy, llms.txt, OG meta tags, AI agent
// discovery files, and the in-product upgrade prompts all derive
// from this file so claims don't drift.
//
// Editing this file is a marketing decision — values lag reality
// when reality moves faster than the public narrative.
package marketing

// Claims is the canonical structure surfaced by the
// /api/v1/marketing/claims endpoint and consumed by the frontend
// build to render landing copy, sitemaps, llms.txt, etc.
type Claims struct {
	ProductName    string `json:"product_name"`
	Tagline        string `json:"tagline"`
	DomainCanonical string `json:"domain_canonical"`
	SupportEmail   string `json:"support_email"`

	ListCount    int `json:"list_count"`
	EntityCount  int `json:"entity_count"`
	LatencyP50Microseconds int `json:"latency_p50_us"`
	LatencyTargetMs        int `json:"latency_target_ms"`

	FreeDailyScreenings int    `json:"free_daily_screenings"`
	StarterPriceUSD     int    `json:"starter_price_usd"`
	ProPriceUSD         int    `json:"pro_price_usd"`
	EnterprisePricing   string `json:"enterprise_pricing"`

	UpgradeURL string `json:"upgrade_url"`
	DocsURL    string `json:"docs_url"`
	StatusURL  string `json:"status_url"`
}

// Canonical returns the approved set of claims. Update via PR with
// the marketing change documented in the commit body so reviewers
// can verify the new number is supported (benchmark, sweep, etc.).
//
// Numbers backed by source-of-truth as of 2026-05-08:
//   - list_count: 89 ingestion parsers (memory:103, Apr 20 audit)
//   - entity_count: 206,796 entities (GLEIF + national lists,
//     memory:101)
//   - latency_p50_us: ~183 µs single-screen on Apple M4 Max
//     (memory:1860, docs/perf/)
//   - latency_target_ms: 50 ms p95 production target
//   - starter_price_usd: from billing/plans_api_sdk.go (api_starter)
func Canonical() Claims {
	return Claims{
		ProductName:    "AMLIQ",
		Tagline:        "AI-powered AML/CFT sanctions screening for financial institutions",
		DomainCanonical: "amliq.com",
		SupportEmail:   "support@amliq.com",

		ListCount:              89,
		EntityCount:            206796,
		LatencyP50Microseconds: 183,
		LatencyTargetMs:        50,

		FreeDailyScreenings: 10,
		StarterPriceUSD:     299,
		ProPriceUSD:         4999,
		EnterprisePricing:   "custom",

		UpgradeURL: "https://amliq.com/billing/checkout?plan=api_starter",
		DocsURL:    "https://amliq.com/docs",
		StatusURL:  "https://amliq.com/status",
	}
}
