package domain

import "testing"

func TestNewCountryRiskEntry(t *testing.T) {
	tests := []struct {
		name      string
		code      string
		name_     string
		score     float64
		shouldErr bool
	}{
		{"valid_iran", "ir", "Iran", 1.0, false},
		{"valid_dprk", "KP", "North Korea", 1.0, false},
		{"valid_low_risk", "nz", "New Zealand", 0.1, false},
		{"code_too_short", "I", "Invalid", 0.5, true},
		{"code_too_long", "IRA", "Invalid", 0.5, true},
		{"score_negative", "US", "USA", -0.1, true},
		{"score_above_one", "US", "USA", 1.5, true},
		{"missing_name", "GB", "", 0.2, true},
		{"whitespace_code", "  GB  ", "UK", 0.2, false},
		{"whitespace_name", "  FR  ", "  France  ", 0.3, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entry, err := NewCountryRiskEntry(tt.code, tt.name_, tt.score)
			if (err != nil) != tt.shouldErr {
				t.Errorf("NewCountryRiskEntry() error = %v, shouldErr = %v", err, tt.shouldErr)
			}
			if !tt.shouldErr {
				if len(entry.Code) != 2 {
					t.Errorf("Code not normalized: %s", entry.Code)
				}
			}
		})
	}
}

func TestCountryRiskLevel(t *testing.T) {
	tests := []struct {
		name          string
		score         float64
		expectedLevel CountryRiskLevel
	}{
		{"very_high_10", 1.0, CountryRiskLevelVeryHigh},
		{"very_high_08", 0.85, CountryRiskLevelVeryHigh},
		{"high_07", 0.75, CountryRiskLevelHigh},
		{"high_06", 0.65, CountryRiskLevelHigh},
		{"medium_05", 0.55, CountryRiskLevelMedium},
		{"medium_04", 0.45, CountryRiskLevelMedium},
		{"low_03", 0.35, CountryRiskLevelLow},
		{"low_02", 0.25, CountryRiskLevelLow},
		{"very_low_01", 0.15, CountryRiskLevelVeryLow},
		{"very_low_00", 0.0, CountryRiskLevelVeryLow},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entry, _ := NewCountryRiskEntry("XX", "Test", tt.score)
			if entry.Level != tt.expectedLevel {
				t.Errorf("Level() = %v, want %v", entry.Level, tt.expectedLevel)
			}
		})
	}
}

func TestCountryRiskIndexScore(t *testing.T) {
	idx := NewCountryRiskIndex()

	iranEntry, _ := NewCountryRiskEntry("IR", "Iran", 1.0)
	idx.AddEntry(iranEntry)

	nzEntry, _ := NewCountryRiskEntry("NZ", "New Zealand", 0.05)
	idx.AddEntry(nzEntry)

	tests := []struct {
		name     string
		code     string
		expected float64
	}{
		{"iran_high_risk", "IR", 1.0},
		{"iran_lowercase", "ir", 1.0},
		{"nz_low_risk", "NZ", 0.05},
		{"unknown_default", "XX", 0.1},
		{"whitespace", "  IR  ", 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := idx.Score(tt.code)
			if score != tt.expected {
				t.Errorf("Score(%s) = %f, want %f", tt.code, score, tt.expected)
			}
		})
	}
}

func TestCountryRiskIndexTenantOverride(t *testing.T) {
	idx := NewCountryRiskIndex()

	iranEntry, _ := NewCountryRiskEntry("IR", "Iran", 1.0)
	idx.AddEntry(iranEntry)

	idx.SetOverride("tenant-001", "IR", 0.5)

	tests := []struct {
		name     string
		tenantID string
		code     string
		expected float64
	}{
		{"default_score", "", "IR", 1.0},
		{"tenant_override", "tenant-001", "IR", 0.5},
		{"different_tenant", "tenant-002", "IR", 1.0},
		{"override_invalid_score_neg", "t1", "IR", -0.1},
		{"override_invalid_score_high", "t2", "IR", 1.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.expected < 0.0 || tt.expected > 1.0 {
				err := idx.SetOverride(tt.tenantID, tt.code, tt.expected)
				if err == nil {
					t.Errorf("SetOverride() should error for score %f", tt.expected)
				}
				return
			}
			_ = idx.SetOverride(tt.tenantID, tt.code, tt.expected)
			score := idx.TenantScore(tt.tenantID, tt.code)
			if score != tt.expected {
				t.Errorf("TenantScore() = %f, want %f", score, tt.expected)
			}
		})
	}
}

func TestCountryRiskIndexEntry(t *testing.T) {
	idx := NewCountryRiskIndex()

	iranEntry, _ := NewCountryRiskEntry("IR", "Iran", 1.0)
	idx.AddEntry(iranEntry)

	tests := []struct {
		name       string
		code       string
		shouldFind bool
	}{
		{"iran_found", "IR", true},
		{"iran_lowercase", "ir", true},
		{"missing_country", "XX", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entry, found := idx.Entry(tt.code)
			if found != tt.shouldFind {
				t.Errorf("Entry() found = %v, want %v", found, tt.shouldFind)
			}
			if found && entry.Code != "IR" {
				t.Errorf("Entry code = %s, want IR", entry.Code)
			}
		})
	}
}

func TestFATFHighRiskCountries(t *testing.T) {
	idx := NewCountryRiskIndex()

	fatfHigh := map[string]float64{
		"IR": 1.0,
		"KP": 1.0,
		"SY": 0.95,
		"MM": 0.90,
	}

	names := map[string]string{"IR": "Iran", "KP": "North Korea", "SY": "Syria", "MM": "Myanmar"}
	for code, score := range fatfHigh {
		entry, _ := NewCountryRiskEntry(code, names[code], score)
		idx.AddEntry(entry)
	}

	tests := []struct {
		name          string
		code          string
		minExpected   float64
		maxExpected   float64
	}{
		{"iran_max_risk", "IR", 0.95, 1.0},
		{"dprk_max_risk", "KP", 0.95, 1.0},
		{"syria_very_high", "SY", 0.9, 1.0},
		{"myanmar_very_high", "MM", 0.85, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := idx.Score(tt.code)
			if score < tt.minExpected || score > tt.maxExpected {
				t.Errorf("Score(%s) = %f, expected between %f and %f",
					tt.code, score, tt.minExpected, tt.maxExpected)
			}
		})
	}
}
