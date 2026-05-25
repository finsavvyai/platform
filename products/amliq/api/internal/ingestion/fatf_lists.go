package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// FATFConfig holds FATF blacklist and greylist country codes.
// Blacklisted = "Call for Action", Greylisted = "Under Monitoring".
type FATFConfig struct {
	Blacklist map[string]bool
	Greylist  map[string]bool
}

// NewFATFConfig returns FATF lists current as of Feb 2026.
func NewFATFConfig() *FATFConfig {
	return &FATFConfig{
		Blacklist: toSet("KP", "IR", "MM"),
		Greylist: toSet(
			"SY", "YE", "BF", "CM", "CD", "HR", "HT",
			"KE", "ML", "MZ", "NG", "PH", "SN", "SS",
			"TZ", "VN", "ZA", "VE", "TR", "JM", "MC",
			"NA", "AL",
		),
	}
}

func toSet(codes ...string) map[string]bool {
	m := make(map[string]bool, len(codes))
	for _, c := range codes {
		m[c] = true
	}
	return m
}

// IsBlacklisted returns true if the country code is FATF blacklisted.
func (f *FATFConfig) IsBlacklisted(countryCode string) bool {
	return f.Blacklist[countryCode]
}

// IsGreylisted returns true if the country code is FATF greylisted.
func (f *FATFConfig) IsGreylisted(countryCode string) bool {
	return f.Greylist[countryCode]
}

// RiskMultiplier returns the FATF risk multiplier for a country code.
// Blacklisted: 3.0, Greylisted: 1.5, Others: 1.0.
func (f *FATFConfig) RiskMultiplier(countryCode string) float64 {
	if f.IsBlacklisted(countryCode) {
		return 3.0
	}
	if f.IsGreylisted(countryCode) {
		return 1.5
	}
	return 1.0
}

// FlagHighRiskCountry returns a risk flag string if the entity's
// nationality matches a FATF-listed country. Returns empty if clean.
func (f *FATFConfig) FlagHighRiskCountry(
	entity domain.Entity,
) string {
	for _, nat := range entity.Nationalities {
		code := normalizeCountryCode(nat)
		if f.IsBlacklisted(code) {
			return "FATF_BLACKLIST:" + code
		}
		if f.IsGreylisted(code) {
			return "FATF_GREYLIST:" + code
		}
	}
	return ""
}

func normalizeCountryCode(code string) string {
	if len(code) >= 2 {
		return code[:2]
	}
	return code
}
