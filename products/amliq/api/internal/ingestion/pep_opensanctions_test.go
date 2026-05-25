package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestPEPOpenSanctionsParser(t *testing.T) {
	data := `{"id":"Q123","schema":"Person","properties":{"name":["Vladimir Putin"],"position":["President of Russia"],"country":["RU"],"startDate":["2000-05-07"]}}
{"id":"Q456","schema":"Person","properties":{"name":["Jane Doe"],"position":["Mayor of Springfield"],"country":["US"],"endDate":["2020-01-01"]}}
{"id":"rel1","schema":"Family","properties":{"person":["Q123"],"relative":["Q789"]}}
`

	parser := NewPEPOpenSanctionsParser()
	profiles, relations := parser.Parse([]byte(data))

	tests := []struct {
		name     string
		check    func() bool
		failMsg  string
	}{
		{"profile_count", func() bool { return len(profiles) == 2 },
			"expected 2 profiles"},
		{"tier1_president", func() bool { return profiles[0].Tier == domain.PEPTier1 },
			"president should be tier 1"},
		{"tier3_mayor", func() bool { return profiles[1].Tier == domain.PEPTier3 },
			"mayor should be tier 3"},
		{"active_status", func() bool { return profiles[0].IsActive && !profiles[1].IsActive },
			"putin active, jane inactive"},
		{"relation_count", func() bool { return len(relations) == 1 },
			"expected 1 relation"},
		{"relation_type", func() bool { return relations[0].RelationType == domain.RCASpouse },
			"family schema -> spouse type"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error(tt.failMsg)
			}
		})
	}
}

func TestClassifyTier(t *testing.T) {
	tests := []struct {
		position string
		want     domain.PEPTier
	}{
		{"President of the Republic", domain.PEPTier1},
		{"Prime Minister", domain.PEPTier1},
		{"Minister of Finance", domain.PEPTier2},
		{"Ambassador to UN", domain.PEPTier2},
		{"Mayor of London", domain.PEPTier3},
		{"Municipal Councillor", domain.PEPTier3},
		{"Board Member", domain.PEPTier4},
	}
	for _, tt := range tests {
		t.Run(tt.position, func(t *testing.T) {
			if got := classifyTier(tt.position); got != tt.want {
				t.Errorf("classifyTier(%q) = %v, want %v", tt.position, got, tt.want)
			}
		})
	}
}
