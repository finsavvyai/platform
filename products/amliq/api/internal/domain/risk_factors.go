package domain

import "fmt"

func identifyFactors(s, p, m, c, i float64) []string {
	var f []string
	if s > 0.5 {
		f = append(f, fmt.Sprintf("sanctions:%.0f%%", s*100))
	}
	if p > 0.5 {
		f = append(f, fmt.Sprintf("pep:%.0f%%", p*100))
	}
	if m > 0.5 {
		f = append(f, fmt.Sprintf("adverse_media:%.0f%%", m*100))
	}
	if c > 0.5 {
		f = append(f, fmt.Sprintf("country_risk:%.0f%%", c*100))
	}
	if i > 0.5 {
		f = append(f, fmt.Sprintf("industry_risk:%.0f%%", i*100))
	}
	return f
}

// CountryRiskScore returns a risk score for high-risk jurisdictions.
// Deprecated: Use CountryRiskIndex for configurable, tenant-specific scoring.
func CountryRiskScore(country string) float64 {
	highRisk := map[string]float64{
		"IR": 1.0, "KP": 1.0, "SY": 0.95, "CU": 0.9,
		"MM": 0.85, "AF": 0.85, "YE": 0.8, "SO": 0.8,
		"LY": 0.75, "SD": 0.75, "VE": 0.7, "IQ": 0.65,
		"LB": 0.6, "PK": 0.55, "NG": 0.5,
	}
	if score, ok := highRisk[country]; ok {
		return score
	}
	return 0.1
}

// CountryRiskScoreFromIndex returns risk score using a configurable index.
func CountryRiskScoreFromIndex(index *CountryRiskIndex, country string) float64 {
	return index.Score(country)
}

// TenantCountryRiskScore returns tenant-specific risk score with overrides.
func TenantCountryRiskScore(index *CountryRiskIndex, tenantID, country string) float64 {
	return index.TenantScore(tenantID, country)
}
