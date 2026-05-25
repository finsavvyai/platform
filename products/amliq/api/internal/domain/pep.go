package domain

import "fmt"

// PEPTier represents the risk tier of a Politically Exposed Person.
type PEPTier int

const (
	PEPTierNone PEPTier = iota
	PEPTier1            // Heads of state, senior government
	PEPTier2            // Regional government, senior military
	PEPTier3            // Local government, party officials
	PEPTier4            // International org officials
)

func (t PEPTier) String() string {
	switch t {
	case PEPTier1:
		return "Tier1-HeadOfState"
	case PEPTier2:
		return "Tier2-SeniorOfficial"
	case PEPTier3:
		return "Tier3-LocalOfficial"
	case PEPTier4:
		return "Tier4-IntlOrg"
	default:
		return "None"
	}
}

func (t PEPTier) RiskWeight() float64 {
	weights := map[PEPTier]float64{
		PEPTier1: 1.0, PEPTier2: 0.8,
		PEPTier3: 0.5, PEPTier4: 0.6,
	}
	return weights[t]
}

func ParsePEPTier(s string) (PEPTier, error) {
	m := map[string]PEPTier{
		"tier1": PEPTier1, "tier2": PEPTier2,
		"tier3": PEPTier3, "tier4": PEPTier4,
		"none": PEPTierNone,
	}
	if t, ok := m[s]; ok {
		return t, nil
	}
	return PEPTierNone, fmt.Errorf("invalid PEP tier: %s", s)
}
