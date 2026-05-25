package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// classifyPEPType determines PEP classification from position and schema.
func classifyPEPType(
	position, schema, country string,
) domain.PEPClassification {
	// If Family or Associate schema, it's an RCA
	if rcaSchemas[schema] {
		return domain.PEPRCA
	}
	// Check for international org keywords
	if hasIntlOrgKeywords(position) {
		return domain.PEPInternationalOrg
	}
	return domain.PEPForeign
}

func hasIntlOrgKeywords(position string) bool {
	keywords := []string{
		"united nations", "un ", "european union", "eu ", "nato",
		"imf", "world bank", "oecd", "wto", "international org",
	}
	lower := strings.ToLower(position)
	for _, kw := range keywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}
