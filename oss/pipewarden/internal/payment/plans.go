package payment

// Plan describes a single PipeWarden subscription tier.
type Plan struct {
	ID           string
	Name         string
	Price        int64 // cents
	Currency     string
	Interval     string
	Features     []string
	MaxAnalyses  int
	MaxProviders int
}

// Canonical three public tiers (free / pro / team) plus a non-public
// Enterprise contact-tier. See GO_TO_MARKET_PLAN.html for the rationale:
// previous 6-plan layout had Professional ($49) cheaper than Team ($99),
// which is the inconsistency this file resolves.

var (
	planFree = Plan{
		ID:           "free",
		Name:         "Free",
		Price:        0,
		Currency:     "usd",
		Interval:     "month",
		MaxAnalyses:  10,
		MaxProviders: 1,
		Features: []string{
			"Unlimited public repos",
			"1 private repo",
			"CLI + GitHub Action",
			"Cheap-mode AI (Haiku / Gemini Flash / DeepSeek)",
			"20 secret patterns · 22 OPA policies · Semgrep ruleset",
			"Community Discord support",
		},
	}
	planPro = Plan{
		ID:           "pro",
		Name:         "Pro",
		Price:        1900,
		Currency:     "usd",
		Interval:     "month",
		MaxAnalyses:  500,
		MaxProviders: 10,
		Features: []string{
			"Unlimited private repos",
			"Sonnet-tier AI on high/critical findings",
			"Claude Code skill + hook (write-time blocks)",
			"Cursor MCP plugin",
			"SARIF history + trend charts",
			"Slack + email notifications",
			"Email support, 48h",
		},
	}
	planTeam = Plan{
		ID:           "team",
		Name:         "Team",
		Price:        4900,
		Currency:     "usd",
		Interval:     "month",
		MaxAnalyses:  2000,
		MaxProviders: 25,
		Features: []string{
			"Everything in Pro",
			"Opus-tier AI on critical paths",
			"Compliance packs (SOC 2 · HIPAA · PCI · GDPR)",
			"SSO (Google + GitHub)",
			"Custom OPA policies",
			"Audit log export",
			"Priority support, 24h",
		},
	}
	planEnterprise = Plan{
		ID:           "enterprise",
		Name:         "Enterprise",
		Price:        0, // contact-sales; price intentionally not surfaced
		Currency:     "usd",
		Interval:     "month",
		MaxAnalyses:  -1,
		MaxProviders: -1,
		Features: []string{
			"Everything in Team",
			"SSO/SAML/SCIM",
			"On-prem deployment",
			"Dedicated support + SLA",
			"Custom contract terms",
		},
	}
)

// Plans is the lookup table used by every billing/handler path.
// Legacy IDs (community, starter, professional, enterprise_plus) are kept
// as ALIASES so subscriptions issued under the old IDs keep resolving;
// they map to the equivalent canonical tier without re-pricing the user.
var Plans = map[string]Plan{
	"free":            planFree,
	"pro":             planPro,
	"team":            planTeam,
	"enterprise":      planEnterprise,
	"community":       planFree,       // legacy alias → Free
	"starter":         planPro,        // legacy alias → Pro (same $19 price)
	"professional":    planTeam,       // legacy alias → Team (was already $49)
	"enterprise_plus": planEnterprise, // legacy alias → Enterprise
}

// PublicPlans lists the tiers that should appear on the marketing page,
// in the dashboard upgrade selector, and in the checkout flow. Enterprise
// is intentionally excluded (contact-sales).
var PublicPlans = []Plan{planFree, planPro, planTeam}

func GetPlan(id string) (Plan, bool) {
	plan, ok := Plans[id]
	return plan, ok
}
