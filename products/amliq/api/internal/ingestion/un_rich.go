package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// applyUNRich promotes UN aliases and documents into the domain
// fields that marshalRichCols serializes (ent.Names and
// ent.Identifiers) so the `aliases` and `identifiers` JSONB columns
// are populated for every UN consolidated record.
func applyUNRich(ent *domain.Entity, m unMeta) {
	addUNAliasNames(ent, m.aliases)
	addUNDocumentIdentifiers(ent, m.documents)
}

func addUNAliasNames(ent *domain.Entity, aliases []string) {
	primary := ""
	if len(ent.Names) > 0 {
		primary = ent.Names[0].Full
	}
	seen := map[string]bool{primary: true}
	for _, a := range aliases {
		a = strings.TrimSpace(a)
		if a == "" || seen[a] {
			continue
		}
		if n, err := domain.NewName(a, "", "", ""); err == nil {
			ent.Names = append(ent.Names, n)
			seen[a] = true
		}
	}
}

func addUNDocumentIdentifiers(ent *domain.Entity, docs []unDocument) {
	for _, d := range docs {
		num := strings.TrimSpace(d.Number)
		if num == "" {
			continue
		}
		typ := mapUNDocType(d.TypeOfDoc)
		country := strings.TrimSpace(d.IssuingCountry)
		id, err := domain.NewIdentifier(typ, num, country)
		if err != nil {
			continue
		}
		ent.Identifiers = append(ent.Identifiers, id)
	}
}

func mapUNDocType(raw string) domain.IdentifierType {
	lower := strings.ToLower(strings.TrimSpace(raw))
	switch {
	case strings.Contains(lower, "passport"):
		return domain.IDPassport
	case strings.Contains(lower, "national"),
		strings.Contains(lower, "identity"):
		return domain.IDNationalID
	case strings.Contains(lower, "tax"):
		return domain.IDTaxID
	case strings.Contains(lower, "registr"):
		return domain.IDRegistration
	default:
		return domain.IDRegistration
	}
}
