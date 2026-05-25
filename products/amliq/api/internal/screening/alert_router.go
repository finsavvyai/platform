package screening

import (
	"sort"

	"github.com/aegis-aml/aegis/internal/domain"
)

// RoutingCondition specifies criteria for alert routing.
type RoutingCondition struct {
	MinRiskScore     float64  // e.g. 0.8
	EntityTypes      []string // e.g. ["vessel", "individual"]
	ListSources      []string // e.g. ["OFAC", "UN"]
	CountryRiskLevel string   // e.g. "very_high"
}

// RoutingRule defines how alerts should be routed based on conditions.
type RoutingRule struct {
	Name         string
	Priority     int // lower = higher priority
	Condition    RoutingCondition
	AssignTo     string // user ID or team
	AutoEscalate bool
}

// AlertRouter routes alerts to assignees based on configurable rules.
type AlertRouter struct {
	rules []RoutingRule
}

func NewAlertRouter(rules []RoutingRule) *AlertRouter {
	sorted := make([]RoutingRule, len(rules))
	copy(sorted, rules)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Priority < sorted[j].Priority
	})
	return &AlertRouter{rules: sorted}
}

// Route returns the assignee and escalation flag for an alert.
// Iterates rules by priority and returns first match.
// Returns empty assignee string if no rule matches (default handling).
func (ar *AlertRouter) Route(
	alert domain.Alert,
	riskScore float64,
	candidate domain.Entity,
) (assignee string, escalate bool) {
	// Iterate rules by priority (lower = higher)
	for _, rule := range ar.rules {
		if ar.matchesCondition(rule.Condition, alert, riskScore, candidate) {
			return rule.AssignTo, rule.AutoEscalate
		}
	}
	return "", false
}

func (ar *AlertRouter) matchesCondition(
	cond RoutingCondition,
	alert domain.Alert,
	riskScore float64,
	candidate domain.Entity,
) bool {
	// Check risk score threshold
	if cond.MinRiskScore > 0 && riskScore < cond.MinRiskScore {
		return false
	}

	// Check entity types
	if len(cond.EntityTypes) > 0 {
		if !ar.entityTypeMatches(candidate, cond.EntityTypes) {
			return false
		}
	}

	// Check list sources
	if len(cond.ListSources) > 0 {
		if !ar.listSourceMatches(alert, cond.ListSources) {
			return false
		}
	}

	// Check country risk level
	if cond.CountryRiskLevel != "" {
		if !ar.countryRiskMatches(candidate, cond.CountryRiskLevel) {
			return false
		}
	}

	return true
}

func (ar *AlertRouter) entityTypeMatches(
	candidate domain.Entity,
	types []string,
) bool {
	candTypeStr := candidate.Type.String()
	for _, t := range types {
		if t == candTypeStr {
			return true
		}
	}
	return false
}

func (ar *AlertRouter) listSourceMatches(
	alert domain.Alert,
	sources []string,
) bool {
	alertSource := alert.MatchResult.ListID
	for _, src := range sources {
		if src == alertSource {
			return true
		}
	}
	return false
}

func (ar *AlertRouter) countryRiskMatches(
	candidate domain.Entity,
	riskLevel string,
) bool {
	// Check metadata for country risk level
	if candidate.Metadata == nil {
		return false
	}
	metaRisk, ok := candidate.Metadata["country_risk_level"]
	if !ok {
		return false
	}
	metaRiskStr, ok := metaRisk.(string)
	if !ok {
		return false
	}
	return metaRiskStr == riskLevel
}
