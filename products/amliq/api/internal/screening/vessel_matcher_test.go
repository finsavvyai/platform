package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestVesselMatcher(t *testing.T) {
	vm := NewVesselMatcher()

	tests := []struct {
		name              string
		queryName         domain.Name
		queryMeta         map[string]interface{}
		candidateName     domain.Name
		candidateMeta     map[string]interface{}
		expectMatch       bool
		expectMinScore    float64
		expectRuleID      string
	}{
		{
			name:        "IMO exact match",
			queryName:   mustName("EVER GIVEN"),
			queryMeta:   map[string]interface{}{"imo": "9811000"},
			candidateName: mustName("EVER GIVEN"),
			candidateMeta: map[string]interface{}{"imo": "9811000"},
			expectMatch:   true,
			expectMinScore: 0.99,
			expectRuleID:   "vessel_imo_exact",
		},
		{
			name:        "MMSI exact match",
			queryName:   mustName("MSC GULSUN"),
			queryMeta:   map[string]interface{}{"mmsi": "636090000"},
			candidateName: mustName("MSC GULSUN"),
			candidateMeta: map[string]interface{}{"mmsi": "636090000"},
			expectMatch:   true,
			expectMinScore: 0.95,
			expectRuleID:   "vessel_mmsi_exact",
		},
		{
			name:        "vessel name fuzzy match high similarity",
			queryName:   mustName("EVER GIVEN"),
			queryMeta:   map[string]interface{}{},
			candidateName: mustName("EVER GVEN"),
			candidateMeta: map[string]interface{}{},
			expectMatch:   true,
			expectMinScore: 0.7,
			expectRuleID:   "vessel_name_fuzzy",
		},
		{
			name:        "flag and name combo match",
			queryName:   mustName("OCEAN GLORY"),
			queryMeta:   map[string]interface{}{"flag": "PA"},
			candidateName: mustName("OCEAN GLORY"),
			candidateMeta: map[string]interface{}{"flag": "PA"},
			expectMatch:   true,
			expectMinScore: 0.8,
			expectRuleID:   "vessel_flag_name",
		},
		{
			name:        "no match - different vessel name",
			queryName:   mustName("EVER GIVEN"),
			queryMeta:   map[string]interface{}{},
			candidateName: mustName("COSCO SHIPPING"),
			candidateMeta: map[string]interface{}{},
			expectMatch:   false,
		},
		{
			name:        "no match - different IMO",
			queryName:   mustName("EVER GIVEN"),
			queryMeta:   map[string]interface{}{"imo": "9811000"},
			candidateName: mustName("EVER GIVEN"),
			candidateMeta: map[string]interface{}{"imo": "9811001"},
			expectMatch:   false,
		},
		{
			name:        "case insensitive IMO",
			queryName:   mustName("Test Vessel"),
			queryMeta:   map[string]interface{}{"imo": "9811000"},
			candidateName: mustName("test vessel"),
			candidateMeta: map[string]interface{}{"imo": "9811000"},
			expectMatch:   true,
			expectMinScore: 0.99,
			expectRuleID:   "vessel_imo_exact",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			evidence := vm.Match(
				tt.queryName,
				[]domain.Name{tt.candidateName},
				tt.queryMeta,
				[]map[string]interface{}{tt.candidateMeta},
			)

			if tt.expectMatch && len(evidence) == 0 {
				t.Errorf("expected match but got none")
			}
			if !tt.expectMatch && len(evidence) > 0 {
				t.Errorf("expected no match but got %d", len(evidence))
			}

			if tt.expectMatch && len(evidence) > 0 {
				ev := evidence[0]
				if ev.Score < tt.expectMinScore {
					t.Errorf(
						"expected score >= %.2f, got %.2f",
						tt.expectMinScore, ev.Score,
					)
				}
				if ev.Algorithm != tt.expectRuleID {
					t.Errorf(
						"expected algorithm %s, got %s",
						tt.expectRuleID, ev.Algorithm,
					)
				}
			}
		})
	}
}

func mustName(full string) domain.Name {
	n, _ := domain.NewName(full, "", "", "")
	return n
}
