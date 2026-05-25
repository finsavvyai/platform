package domain

import "time"

// RiskLevel categorizes composite risk.
type RiskLevel string

const (
	RiskCritical RiskLevel = "critical"
	RiskHigh     RiskLevel = "high"
	RiskMedium   RiskLevel = "medium"
	RiskLow      RiskLevel = "low"
)

// RiskScore holds a composite risk assessment for an entity.
type RiskScore struct {
	EntityID       string
	TenantID       TenantID
	SanctionsScore float64 // 0-1
	PEPScore       float64
	AdverseMedia   float64
	CountryRisk    float64
	IndustryRisk   float64
	CompositeScore float64
	Level          RiskLevel
	Factors        []string
	CalculatedAt   time.Time
}

// RiskWeights configures the relative importance of each factor.
type RiskWeights struct {
	Sanctions    float64 `json:"sanctions"`
	PEP          float64 `json:"pep"`
	AdverseMedia float64 `json:"adverse_media"`
	Country      float64 `json:"country"`
	Industry     float64 `json:"industry"`
}

func DefaultRiskWeights() RiskWeights {
	return RiskWeights{
		Sanctions: 0.35, PEP: 0.25, AdverseMedia: 0.20,
		Country: 0.10, Industry: 0.10,
	}
}

func CalculateRiskScore(
	entityID string, tenantID TenantID,
	sanctions, pep, media, country, industry float64,
	weights RiskWeights,
) RiskScore {
	composite := sanctions*weights.Sanctions +
		pep*weights.PEP + media*weights.AdverseMedia +
		country*weights.Country + industry*weights.Industry
	level := classifyRisk(composite)
	factors := identifyFactors(sanctions, pep, media, country, industry)
	return RiskScore{
		EntityID: entityID, TenantID: tenantID,
		SanctionsScore: sanctions, PEPScore: pep,
		AdverseMedia: media, CountryRisk: country,
		IndustryRisk: industry, CompositeScore: composite,
		Level: level, Factors: factors,
		CalculatedAt: time.Now().UTC(),
	}
}

func classifyRisk(score float64) RiskLevel {
	switch {
	case score >= 0.8:
		return RiskCritical
	case score >= 0.6:
		return RiskHigh
	case score >= 0.3:
		return RiskMedium
	default:
		return RiskLow
	}
}
