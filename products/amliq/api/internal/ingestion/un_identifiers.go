package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// unDocsToIdentifiers converts UN INDIVIDUAL_DOCUMENT entries into
// structured domain.Identifier values. Lets the screening engine
// exact-match on passport / national-ID numbers instead of hoping
// fuzzy name match carries the load.
func unDocsToIdentifiers(docs []unDocument) []domain.Identifier {
	var out []domain.Identifier
	for _, d := range docs {
		num := strings.TrimSpace(d.Number)
		if num == "" {
			continue
		}
		idType := classifyUNDocType(d.TypeOfDoc)
		country := strings.TrimSpace(d.IssuingCountry)
		id, err := domain.NewIdentifier(idType, num, country)
		if err != nil {
			continue
		}
		out = append(out, id)
	}
	return out
}

// classifyUNDocType maps UN TYPE_OF_DOCUMENT free-text to a known
// IdentifierType. Unknown types fall back to passport (the most
// common UN ID doc) rather than discarding them.
func classifyUNDocType(raw string) domain.IdentifierType {
	s := strings.ToLower(strings.TrimSpace(raw))
	switch {
	case strings.Contains(s, "passport"):
		return domain.IDPassport
	case strings.Contains(s, "national"),
		strings.Contains(s, "identity"),
		strings.Contains(s, "id card"):
		return domain.IDNationalID
	case strings.Contains(s, "tax"):
		return domain.IDTaxID
	case strings.Contains(s, "registration"),
		strings.Contains(s, "company"):
		return domain.IDRegistration
	case strings.Contains(s, "imo"):
		return domain.IDIMOID
	default:
		return domain.IDPassport
	}
}
