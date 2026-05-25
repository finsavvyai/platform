package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func advSetDatesAndPlaces(ent *domain.Entity, dobs []advDateOfBirth, pobs []advPlaceOfBirth) {
	if len(dobs) > 0 {
		dobStr := strings.TrimSpace(dobs[0].DateOfBirth)
		if dobStr != "" {
			parseDOB(ent, dobStr)
		}
	}

	if len(pobs) > 0 {
		pob := joinSemi(
			strings.TrimSpace(pobs[0].City),
			strings.TrimSpace(pobs[0].Country),
		)
		if pob != "" {
			setMeta(ent, "birth_place", pob)
		}
	}
}

func mapGender(code string) string {
	lower := strings.ToLower(strings.TrimSpace(code))
	switch lower {
	case "f", "female", "w":
		return "Female"
	case "m", "male":
		return "Male"
	default:
		return ""
	}
}
