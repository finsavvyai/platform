package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// splitSemiToAddresses splits semicolon-separated addresses.
func splitSemiToAddresses(ent *domain.Entity, raw string) {
	for _, a := range splitSemi(raw) {
		addUnique(&ent.Addresses, a)
	}
}

// splitSemiToNationalities splits semicolon-separated countries.
func splitSemiToNationalities(ent *domain.Entity, raw string) {
	for _, n := range splitSemi(raw) {
		addUnique(&ent.Nationalities, n)
	}
}

// splitSemiToIdentifiers splits semicolon-separated identifiers.
func splitSemiToIdentifiers(ent *domain.Entity, raw string) {
	if raw == "" {
		return
	}
	setMeta(ent, "identifiers", raw)
	for _, v := range splitSemi(raw) {
		id, err := domain.NewIdentifier(domain.IDRegistration, v, "")
		if err == nil {
			ent.Identifiers = append(ent.Identifiers, id)
		}
	}
}

// splitSemiToAliases splits semicolon-separated aliases into Names.
func splitSemiToAliases(ent *domain.Entity, raw string) {
	if raw == "" {
		return
	}
	setMeta(ent, "aliases", raw)
	for _, a := range splitSemi(raw) {
		normalized := NormalizeName(a)
		if normalized == "" {
			continue
		}
		name, err := domain.NewName(normalized, "", "", "")
		if err == nil {
			ent.Names = append(ent.Names, name)
		}
	}
}

// setNameParts populates given/family on primary Name.
func setNameParts(ent *domain.Entity, rec []string, hdr headerIndex) {
	if len(ent.Names) == 0 {
		return
	}
	given := hdr.get(rec, "given_name", "first_name")
	family := hdr.get(rec, "surname", "last_name", "second_name")
	if given != "" {
		ent.Names[0].Given = given
	}
	if family != "" {
		ent.Names[0].Family = family
	}
}

// splitSemi splits a semicolon-separated string, trimming spaces.
func splitSemi(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ";")
	var out []string
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}
