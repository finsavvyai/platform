package ingestion

import (
	"bytes"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// detectOFACDelimiter checks if data uses pipe or comma delimiter.
func detectOFACDelimiter(data []byte) rune {
	// Check first 500 bytes for pipe characters
	sample := data
	if len(sample) > 500 {
		sample = sample[:500]
	}
	if bytes.ContainsRune(sample, '|') {
		return '|'
	}
	return ','
}

func mapOFACEntityType(raw string) domain.EntityType {
	lower := strings.ToLower(strings.TrimSpace(raw))
	switch {
	case strings.Contains(lower, "vessel"):
		return domain.EntityTypeVessel
	case strings.Contains(lower, "aircraft"):
		return domain.EntityTypeAircraft
	case lower == "" || lower == "-0-" || lower == "-":
		return domain.EntityTypeIndividual
	case strings.Contains(lower, "individual"):
		return domain.EntityTypeIndividual
	default:
		return domain.EntityTypeCompany
	}
}
