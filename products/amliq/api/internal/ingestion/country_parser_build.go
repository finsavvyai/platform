package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// buildCountryEntity constructs a domain.Entity from an OpenSanctions
// CSV record that has already been filtered by country prefix.
func buildCountryEntity(
	rec []string, hdr headerIndex,
	rawID string, typ domain.EntityType, listID string,
) (domain.Entity, bool) {
	fullName := resolveCountryName(rec, hdr, typ)
	if fullName == "" {
		return domain.Entity{}, false
	}

	normalized := NormalizeName(fullName)
	if isOneWord(normalized) && typ == domain.EntityTypeIndividual {
		return domain.Entity{}, false
	}

	id, _ := domain.NewEntityID("ent_" + rawID[:12])
	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}

	ent.ListID = listID
	setExtendedFields(&ent, rec, hdr)
	return ent, true
}

func resolveCountryName(
	rec []string, hdr headerIndex, typ domain.EntityType,
) string {
	fullName := hdr.get(rec, "name")
	first := hdr.get(rec, "given_name", "first_name")
	last := hdr.get(rec, "surname", "last_name", "second_name")
	if fullName == "" {
		return joinNonEmpty(first, last)
	}
	if typ == domain.EntityTypeIndividual && isOneWord(fullName) {
		if c := joinNonEmpty(first, last); c != "" {
			return c
		}
	}
	return fullName
}
