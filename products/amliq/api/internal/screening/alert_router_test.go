package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestAlertRouter(t *testing.T) {
	tests := []struct {
		name             string
		rules            []RoutingRule
		alert            domain.Alert
		riskScore        float64
		candidate        domain.Entity
		expectedAssignee string
		expectedEscalate bool
	}{
		{
			name: "High risk score routes to senior analyst",
			rules: []RoutingRule{
				{
					Name:     "HighRiskRule",
					Priority: 1,
					Condition: RoutingCondition{
						MinRiskScore: 0.85,
					},
					AssignTo:     "senior_analyst_01",
					AutoEscalate: true,
				},
			},
			alert: domain.Alert{
				MatchResult: domain.MatchResult{
					ListID: "OFAC",
				},
			},
			riskScore: 0.90,
			candidate: domain.Entity{
				Type: domain.EntityTypeIndividual,
			},
			expectedAssignee: "senior_analyst_01",
			expectedEscalate: true,
		},
		{
			name: "Vessel entity routes to maritime team",
			rules: []RoutingRule{
				{
					Name:     "VesselRule",
					Priority: 1,
					Condition: RoutingCondition{
						EntityTypes: []string{"Vessel"},
					},
					AssignTo:     "maritime_team",
					AutoEscalate: false,
				},
			},
			alert: domain.Alert{
				MatchResult: domain.MatchResult{
					ListID: "UN",
				},
			},
			riskScore: 0.70,
			candidate: domain.Entity{
				Type: domain.EntityTypeVessel,
			},
			expectedAssignee: "maritime_team",
			expectedEscalate: false,
		},
		{
			name: "OFAC match auto-escalates",
			rules: []RoutingRule{
				{
					Name:     "OFACRule",
					Priority: 1,
					Condition: RoutingCondition{
						ListSources: []string{"OFAC"},
					},
					AssignTo:     "ofac_specialist",
					AutoEscalate: true,
				},
			},
			alert: domain.Alert{
				MatchResult: domain.MatchResult{
					ListID: "OFAC",
				},
			},
			riskScore: 0.75,
			candidate: domain.Entity{
				Type: domain.EntityTypeIndividual,
			},
			expectedAssignee: "ofac_specialist",
			expectedEscalate: true,
		},
		{
			name: "No matching rule returns default",
			rules: []RoutingRule{
				{
					Name:     "HighRiskRule",
					Priority: 1,
					Condition: RoutingCondition{
						MinRiskScore: 0.95,
					},
					AssignTo:     "senior_analyst_01",
					AutoEscalate: true,
				},
			},
			alert: domain.Alert{
				MatchResult: domain.MatchResult{
					ListID: "UN",
				},
			},
			riskScore: 0.70,
			candidate: domain.Entity{
				Type: domain.EntityTypeIndividual,
			},
			expectedAssignee: "",
			expectedEscalate: false,
		},
		{
			name: "Multiple rules, highest priority wins",
			rules: []RoutingRule{
				{
					Name:     "LowPriority",
					Priority: 2,
					Condition: RoutingCondition{
						MinRiskScore: 0.50,
					},
					AssignTo:     "junior_analyst",
					AutoEscalate: false,
				},
				{
					Name:     "HighPriority",
					Priority: 1,
					Condition: RoutingCondition{
						MinRiskScore: 0.80,
					},
					AssignTo:     "senior_analyst_01",
					AutoEscalate: true,
				},
			},
			alert: domain.Alert{
				MatchResult: domain.MatchResult{
					ListID: "OFAC",
				},
			},
			riskScore: 0.85,
			candidate: domain.Entity{
				Type: domain.EntityTypeIndividual,
			},
			expectedAssignee: "senior_analyst_01",
			expectedEscalate: true,
		},
		{
			name: "Country risk-based routing",
			rules: []RoutingRule{
				{
					Name:     "VeryHighRiskCountry",
					Priority: 1,
					Condition: RoutingCondition{
						CountryRiskLevel: "very_high",
					},
					AssignTo:     "country_risk_team",
					AutoEscalate: true,
				},
			},
			alert: domain.Alert{
				MatchResult: domain.MatchResult{
					ListID: "EU",
				},
			},
			riskScore: 0.65,
			candidate: domain.Entity{
				Type: domain.EntityTypeCompany,
				Metadata: map[string]interface{}{
					"country_risk_level": "very_high",
				},
			},
			expectedAssignee: "country_risk_team",
			expectedEscalate: true,
		},
		{
			name: "Multiple condition types (AND logic)",
			rules: []RoutingRule{
				{
					Name:     "ComplexRule",
					Priority: 1,
					Condition: RoutingCondition{
						MinRiskScore:     0.80,
						EntityTypes:      []string{"Individual"},
						ListSources:      []string{"OFAC"},
						CountryRiskLevel: "very_high",
					},
					AssignTo:     "specialized_team",
					AutoEscalate: true,
				},
			},
			alert: domain.Alert{
				MatchResult: domain.MatchResult{
					ListID: "OFAC",
				},
			},
			riskScore: 0.85,
			candidate: domain.Entity{
				Type: domain.EntityTypeIndividual,
				Metadata: map[string]interface{}{
					"country_risk_level": "very_high",
				},
			},
			expectedAssignee: "specialized_team",
			expectedEscalate: true,
		},
		{
			name: "Risk score below threshold doesn't match",
			rules: []RoutingRule{
				{
					Name:     "HighRiskRule",
					Priority: 1,
					Condition: RoutingCondition{
						MinRiskScore: 0.85,
					},
					AssignTo:     "senior_analyst_01",
					AutoEscalate: true,
				},
			},
			alert: domain.Alert{
				MatchResult: domain.MatchResult{
					ListID: "OFAC",
				},
			},
			riskScore: 0.70,
			candidate: domain.Entity{
				Type: domain.EntityTypeIndividual,
			},
			expectedAssignee: "",
			expectedEscalate: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := NewAlertRouter(tt.rules)
			assignee, escalate := router.Route(tt.alert, tt.riskScore, tt.candidate)

			if assignee != tt.expectedAssignee {
				t.Errorf("Route() assignee = %q, want %q", assignee, tt.expectedAssignee)
			}
			if escalate != tt.expectedEscalate {
				t.Errorf("Route() escalate = %v, want %v", escalate, tt.expectedEscalate)
			}
		})
	}
}

func TestAlertRouterSorting(t *testing.T) {
	// Test that rules are sorted by priority (lower number = higher priority)
	rules := []RoutingRule{
		{
			Name:     "LowPriority",
			Priority: 3,
			Condition: RoutingCondition{
				MinRiskScore: 0.50,
			},
			AssignTo:     "junior_analyst",
			AutoEscalate: false,
		},
		{
			Name:     "HighPriority",
			Priority: 1,
			Condition: RoutingCondition{
				MinRiskScore: 0.60,
			},
			AssignTo:     "senior_analyst",
			AutoEscalate: true,
		},
	}

	router := NewAlertRouter(rules)
	alert := domain.Alert{
		MatchResult: domain.MatchResult{
			ListID: "OFAC",
		},
	}
	candidate := domain.Entity{
		Type: domain.EntityTypeIndividual,
	}

	// Both conditions match, highest priority (lowest number) wins
	assignee, escalate := router.Route(alert, 0.70, candidate)
	if assignee != "senior_analyst" {
		t.Errorf("Route() should return highest priority rule, got %q", assignee)
	}
	if !escalate {
		t.Errorf("Route() escalate should be true for highest priority rule")
	}
}
