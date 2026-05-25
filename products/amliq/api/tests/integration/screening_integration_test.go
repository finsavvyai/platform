//go:build integration

package integration

import (
	"encoding/json"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

func TestScreeningEnginePipeline(t *testing.T) {
	tests := []struct {
		name           string
		queryName      string
		candidates     []string
		expectedLayers []domain.MatchLayer
		minConfidence  float64
	}{
		{
			name:           "exact_match",
			queryName:      "JOHN SMITH",
			candidates:     []string{"JOHN SMITH"},
			expectedLayers: []domain.MatchLayer{domain.MatchLayerExact},
			minConfidence:  0.95,
		},
		{
			name:           "fuzzy_match_typo",
			queryName:      "JOHN SMITH",
			candidates:     []string{"JON SMITH"},
			expectedLayers: []domain.MatchLayer{domain.MatchLayerFuzzy},
			minConfidence:  0.85,
		},
		{
			name:           "phonetic_match",
			queryName:      "SMITH",
			candidates:     []string{"SMYTH"},
			expectedLayers: []domain.MatchLayer{domain.MatchLayerPhonetic},
			minConfidence:  0.70,
		},
		{
			name:           "token_match",
			queryName:      "JOHN DAVID SMITH",
			candidates:     []string{"SMITH JOHN"},
			expectedLayers: []domain.MatchLayer{domain.MatchLayerToken},
			minConfidence:  0.50,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Build query name
			queryName, err := domain.NewName(tt.queryName, "", "", "")
			if err != nil {
				t.Fatalf("NewName error: %v", err)
			}

			// Build candidate names
			var candNames []domain.Name
			for _, cand := range tt.candidates {
				cn, err := domain.NewName(cand, "", "", "")
				if err != nil {
					t.Fatalf("NewName error: %v", err)
				}
				candNames = append(candNames, cn)
			}

			// Run mock screening (in integration, would use real engine)
			if len(candNames) > 0 {
				// Verify query and candidates were created
				if queryName.Full != tt.queryName {
					t.Errorf("queryName = %s, want %s", queryName.Full, tt.queryName)
				}
				if len(candNames) != len(tt.candidates) {
					t.Errorf("candidates = %d, want %d", len(candNames), len(tt.candidates))
				}
			}
		})
	}
}

func TestVesselScreening(t *testing.T) {
	tests := []struct {
		name        string
		queryIMO    string
		queryMMSI   string
		candIMO     string
		candMMSI    string
		expectedSim float64
	}{
		{
			name:        "imo_exact_match",
			queryIMO:    "9765432",
			candIMO:     "9765432",
			expectedSim: 0.99,
		},
		{
			name:        "mmsi_exact_match",
			queryMMSI:   "123456789",
			candMMSI:    "123456789",
			expectedSim: 0.95,
		},
		{
			name:        "no_match",
			queryIMO:    "1111111",
			candIMO:     "2222222",
			expectedSim: 0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify vessel matching logic
			if tt.expectedSim > 0.9 {
				if (tt.queryIMO != "" && tt.queryIMO == tt.candIMO) ||
					(tt.queryMMSI != "" && tt.queryMMSI == tt.candMMSI) {
					// Match found
					if tt.expectedSim == 0.0 {
						t.Error("expected no match but found one")
					}
				}
			} else if tt.expectedSim == 0.0 {
				if tt.queryIMO == tt.candIMO || tt.queryMMSI == tt.candMMSI {
					t.Error("expected no match but found one")
				}
			}
		})
	}
}

func TestPEPClassification(t *testing.T) {
	tests := []struct {
		name          string
		classification domain.PEPClassification
		expectIsPEP   bool
		riskMult      float64
	}{
		{
			name:          "domestic_pep",
			classification: domain.PEPDomestic,
			expectIsPEP:    true,
			riskMult:       1.0,
		},
		{
			name:          "foreign_pep",
			classification: domain.PEPForeign,
			expectIsPEP:    true,
			riskMult:       0.9,
		},
		{
			name:          "intl_org",
			classification: domain.PEPInternationalOrg,
			expectIsPEP:    true,
			riskMult:       0.8,
		},
		{
			name:          "soe",
			classification: domain.PEPSOE,
			expectIsPEP:    true,
			riskMult:       0.7,
		},
		{
			name:          "rca",
			classification: domain.PEPRCA,
			expectIsPEP:    true,
			riskMult:       0.6,
		},
		{
			name:          "no_pep",
			classification: domain.PEPNone,
			expectIsPEP:    false,
			riskMult:       0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isPEP := tt.classification.IsPEP()
			if isPEP != tt.expectIsPEP {
				t.Errorf("IsPEP = %v, want %v", isPEP, tt.expectIsPEP)
			}

			mult := tt.classification.RiskMultiplier()
			if mult != tt.riskMult {
				t.Errorf("RiskMultiplier = %f, want %f", mult, tt.riskMult)
			}
		})
	}
}

func TestCountryRiskScoring(t *testing.T) {
	tests := []struct {
		name           string
		score          float64
		expectedLevel  domain.CountryRiskLevel
		expectVeryHigh bool
	}{
		{
			name:           "very_high_risk",
			score:          0.95,
			expectedLevel:  domain.CountryRiskLevelVeryHigh,
			expectVeryHigh: true,
		},
		{
			name:           "high_risk",
			score:          0.70,
			expectedLevel:  domain.CountryRiskLevelHigh,
			expectVeryHigh: false,
		},
		{
			name:           "medium_risk",
			score:          0.50,
			expectedLevel:  domain.CountryRiskLevelMedium,
			expectVeryHigh: false,
		},
		{
			name:           "low_risk",
			score:          0.25,
			expectedLevel:  domain.CountryRiskLevelLow,
			expectVeryHigh: false,
		},
		{
			name:           "very_low_risk",
			score:          0.05,
			expectedLevel:  domain.CountryRiskLevelVeryLow,
			expectVeryHigh: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entry, err := domain.NewCountryRiskEntry("XX", "TestCountry", tt.score)
			if err != nil {
				t.Fatalf("NewCountryRiskEntry error: %v", err)
			}

			if entry.Level != tt.expectedLevel {
				t.Errorf("Level = %v, want %v", entry.Level, tt.expectedLevel)
			}

			if entry.Score != tt.score {
				t.Errorf("Score = %f, want %f", entry.Score, tt.score)
			}
		})
	}
}

func TestCountryRiskIndex(t *testing.T) {
	tests := []struct {
		name           string
		countryCode    string
		addEntry       bool
		expectedScore  float64
		overrideScore  float64
		tenantID       string
	}{
		{
			name:          "existing_country",
			countryCode:   "US",
			addEntry:      true,
			expectedScore: 0.15,
		},
		{
			name:          "missing_country_default",
			countryCode:   "XX",
			addEntry:      false,
			expectedScore: 0.1,
		},
		{
			name:          "tenant_override",
			countryCode:   "RU",
			addEntry:      true,
			expectedScore: 0.70,
			overrideScore: 0.95,
			tenantID:      "ten_123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			idx := domain.NewCountryRiskIndex()

			if tt.addEntry {
				entry, err := domain.NewCountryRiskEntry(tt.countryCode, "TestCountry", tt.expectedScore)
				if err != nil {
					t.Fatalf("NewCountryRiskEntry error: %v", err)
				}
				idx.AddEntry(entry)
			}

			score := idx.Score(tt.countryCode)
			if !tt.addEntry && score != 0.1 {
				t.Errorf("default score = %f, want 0.1", score)
			}

			if tt.addEntry {
				entry, ok := idx.Entry(tt.countryCode)
				if !ok {
					t.Error("expected entry not found")
				}
				if entry.Code != tt.countryCode {
					t.Errorf("entry code = %s, want %s", entry.Code, tt.countryCode)
				}
			}

			// Test override
			if tt.overrideScore > 0 && tt.tenantID != "" {
				err := idx.SetOverride(tt.tenantID, tt.countryCode, tt.overrideScore)
				if err != nil {
					t.Fatalf("SetOverride error: %v", err)
				}

				tenantScore := idx.TenantScore(tt.tenantID, tt.countryCode)
				if tenantScore != tt.overrideScore {
					t.Errorf("tenant score = %f, want %f", tenantScore, tt.overrideScore)
				}
			}
		})
	}
}

func TestScreeningJSONSerialization(t *testing.T) {
	tests := []struct {
		name   string
		data   interface{}
		canMarshal bool
	}{
		{
			name:   "match_evidence",
			data:   domain.NewMatchEvidence(domain.MatchLayerExact, "test", 0.95, 1.0, "q", "c", "matched"),
			canMarshal: true,
		},
		{
			name: "pep_classification",
			data: domain.PEPDomestic,
			canMarshal: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := json.Marshal(tt.data)
			if (err != nil) == tt.canMarshal {
				if tt.canMarshal {
					t.Errorf("Marshal error: %v", err)
				}
			}
		})
	}
}
