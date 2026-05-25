package domain

import "fmt"

// PEPClassification represents PEP sub-classification types.
type PEPClassification string

const (
	PEPDomestic         PEPClassification = "domestic"
	PEPForeign          PEPClassification = "foreign"
	PEPInternationalOrg PEPClassification = "intl_org"
	PEPSOE              PEPClassification = "soe"
	PEPRCA              PEPClassification = "rca"
	PEPNone             PEPClassification = "none"
)

// NewPEPClassification validates and returns a PEP classification.
func NewPEPClassification(s string) (PEPClassification, error) {
	validTypes := map[string]PEPClassification{
		"domestic":  PEPDomestic,
		"foreign":   PEPForeign,
		"intl_org":  PEPInternationalOrg,
		"soe":       PEPSOE,
		"rca":       PEPRCA,
		"none":      PEPNone,
	}
	if c, ok := validTypes[s]; ok {
		return c, nil
	}
	return PEPNone, fmt.Errorf("invalid PEP classification: %s", s)
}

// IsPEP returns true if this classification represents a PEP.
func (c PEPClassification) IsPEP() bool {
	return c != PEPNone
}

// RiskMultiplier returns a risk adjustment factor for this classification.
func (c PEPClassification) RiskMultiplier() float64 {
	weights := map[PEPClassification]float64{
		PEPDomestic:         1.0,
		PEPForeign:          0.9,
		PEPInternationalOrg: 0.8,
		PEPSOE:              0.7,
		PEPRCA:              0.6,
		PEPNone:             0.0,
	}
	return weights[c]
}

// String returns the string representation.
func (c PEPClassification) String() string {
	return string(c)
}
