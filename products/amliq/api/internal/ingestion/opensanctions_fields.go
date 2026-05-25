package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// resolveName picks the best available name from OpenSanctions CSV.
// Priority: holder > name > first+last fallback.
func (p *OpenSanctionsParser) resolveName(
	rec []string, hdr headerIndex, typ domain.EntityType,
) string {
	// "holder" overrides if present
	if holder := hdr.get(rec, "holder"); holder != "" {
		return holder
	}
	fullName := hdr.get(rec, p.nameColumn)

	// Try first+last fallback for empty or single-word names
	first := hdr.get(rec, "given_name", "first_name")
	last := hdr.get(rec, "surname", "last_name", "second_name")

	if fullName == "" {
		return joinNonEmpty(first, last)
	}
	if typ == domain.EntityTypeIndividual && isOneWord(fullName) {
		if composed := joinNonEmpty(first, last); composed != "" {
			return composed
		}
	}
	return fullName
}

// setExtendedFields populates Entity fields and Metadata.
func setExtendedFields(
	ent *domain.Entity, rec []string, hdr headerIndex,
) {
	setMeta(ent, "program", hdr.get(rec, "program_ids"))
	setMeta(ent, "phones", hdr.get(rec, "phones"))
	setMeta(ent, "emails", hdr.get(rec, "emails"))
	setMeta(ent, "sanctions", hdr.get(rec, "sanctions"))
	setMeta(ent, "dataset", hdr.get(rec, "dataset"))
	setMeta(ent, "schema", hdr.get(rec, "schema"))
	setMeta(ent, "first_seen", hdr.get(rec, "first_seen"))
	setMeta(ent, "last_seen", hdr.get(rec, "last_seen"))
	setMeta(ent, "last_change", hdr.get(rec, "last_change"))

	splitSemiToAddresses(ent, hdr.get(rec, "addresses"))
	splitSemiToNationalities(ent, hdr.get(rec, "countries"))
	splitSemiToIdentifiers(ent, hdr.get(rec, "identifiers"))
	splitSemiToAliases(ent, hdr.get(rec, "aliases"))

	if dob := hdr.get(rec, "birth_date"); dob != "" {
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}

	setNameParts(ent, rec, hdr)
}

func setMeta(ent *domain.Entity, key, val string) {
	if val != "" {
		ent.Metadata[key] = val
	}
}

func joinNonEmpty(parts ...string) string {
	var out []string
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	return strings.Join(out, " ")
}

func isOneWord(name string) bool {
	return !strings.Contains(strings.TrimSpace(name), " ")
}
