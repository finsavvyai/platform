package mcp

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func registerRiskHandlers(s *Server) {
	s.tools["check_country_risk"] = handleCountryRisk
}

func handleCountryRisk(params json.RawMessage) (interface{}, error) {
	var p struct {
		CountryCode string `json:"country_code"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, fmt.Errorf("bad params: %w", err)
	}
	code := strings.ToUpper(p.CountryCode)
	riskScore := domain.CountryRiskScore(code)
	profile := domain.GetRegulatoryProfile(code)
	blacklisted := isBlacklisted(code)
	greylisted := isGreylisted(code)
	multiplier := riskMultiplier(riskScore, blacklisted, greylisted)

	return map[string]interface{}{
		"country_code":  code,
		"blacklisted":   blacklisted,
		"greylisted":    greylisted,
		"risk_score":    riskScore,
		"risk_multiplier": multiplier,
		"regulator":     profile.Regulator,
		"required_lists": profile.RequiredLists,
		"pep_scope":     profile.PEPScope,
	}, nil
}

// FATF black list — call for action jurisdictions.
func isBlacklisted(code string) bool {
	blacklist := map[string]bool{
		"IR": true, "KP": true, "MM": true,
	}
	return blacklist[code]
}

// FATF grey list — increased monitoring jurisdictions.
func isGreylisted(code string) bool {
	greylist := map[string]bool{
		"SY": true, "YE": true, "AF": true, "SO": true,
		"SD": true, "VE": true, "LY": true, "LB": true,
		"NG": true, "PK": true, "JM": true, "TZ": true,
		"TR": true, "VN": true, "ML": true, "SS": true,
		"HT": true, "PH": true, "MZ": true, "CM": true,
	}
	return greylist[code]
}

func riskMultiplier(
	riskScore float64, blacklisted, greylisted bool,
) float64 {
	switch {
	case blacklisted:
		return 3.0
	case greylisted:
		return 2.0
	case riskScore > 0.7:
		return 1.5
	default:
		return 1.0
	}
}
