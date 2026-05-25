package screening

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// PEPClassifier determines PEP sub-classifications.
type PEPClassifier struct {
	screeningCountry string
}

// NewPEPClassifier creates a new PEP classifier.
func NewPEPClassifier(screeningCountry string) *PEPClassifier {
	return &PEPClassifier{
		screeningCountry: screeningCountry,
	}
}

// Classify determines PEP classification for a profile.
func (c *PEPClassifier) Classify(profile domain.PEPProfile) domain.PEPClassification {
	// If profile has RCA relations, it's an RCA
	if len(profile.Relations) > 0 {
		return domain.PEPRCA
	}

	// If country matches screening country, it's domestic
	if strings.EqualFold(profile.Country, c.screeningCountry) {
		return domain.PEPDomestic
	}

	// Check for international org keywords
	if hasIntlOrgKeyword(profile.Position) {
		return domain.PEPInternationalOrg
	}

	// Otherwise, it's foreign
	return domain.PEPForeign
}

// hasIntlOrgKeyword checks if position contains intl org keywords.
func hasIntlOrgKeyword(position string) bool {
	keywords := []string{
		"united nations", "un ", "european union", "eu ", "nato",
		"imf", "world bank", "oecd", "wto", "international org",
		"global institution", "multinational org",
	}
	lower := strings.ToLower(position)
	for _, kw := range keywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}
