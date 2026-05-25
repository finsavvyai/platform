package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichBulkFromFlatCols pulls rich fields directly from the
// OpenSanctions *simple* CSV format, which uses flat semicolon-
// delimited columns rather than a `properties` JSON blob. This is
// the path hit in production for targets.simple.csv (the URL
// BulkDataURL points at). Without it, ~554k bulk entities land in
// the DB with empty addresses / identifiers / aliases JSONB cols.
func enrichBulkFromFlatCols(
	ent *domain.Entity, rec []string, hdr headerIndex,
) {
	if dob := hdr.get(rec, "birth_date", "birthDate"); dob != "" && ent.DOB == nil {
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}
	for _, c := range splitMulti(hdr.get(rec, "countries", "country")) {
		addUnique(&ent.Nationalities, c)
	}
	for _, a := range splitMulti(hdr.get(rec, "addresses")) {
		if a != "" {
			addUnique(&ent.Addresses, a)
		}
	}
	addBulkFlatAliases(ent, hdr.get(rec, "aliases"))
	addBulkFlatIdentifiers(ent, hdr.get(rec, "identifiers"))
	setMeta(ent, "emails", hdr.get(rec, "emails"))
	setMeta(ent, "phones", hdr.get(rec, "phones"))
	setMeta(ent, "source_url", hdr.get(rec, "source_url", "sourceUrl"))
}

// addBulkFlatAliases appends each non-empty, non-primary alias as
// an additional Name on the main entity so it is serialized into
// the aliases JSONB column by marshalRichCols.
func addBulkFlatAliases(ent *domain.Entity, raw string) {
	if raw == "" {
		return
	}
	setMeta(ent, "aliases", raw)
	primary := ""
	if len(ent.Names) > 0 {
		primary = ent.Names[0].Full
	}
	for _, a := range splitMulti(raw) {
		if a == "" || a == primary {
			continue
		}
		if n, err := domain.NewName(a, "", "", ""); err == nil {
			ent.Names = append(ent.Names, n)
		}
	}
}

// addBulkFlatIdentifiers splits the semi-colon delimited identifiers
// column and tags each value with a generic `opensanctions` type —
// the simple CSV doesn't carry per-value type info.
func addBulkFlatIdentifiers(ent *domain.Entity, raw string) {
	if raw == "" {
		return
	}
	for _, v := range splitMulti(raw) {
		if v == "" {
			continue
		}
		id, err := domain.NewIdentifier(
			domain.IdentifierType("opensanctions"), v, "")
		if err != nil {
			continue
		}
		ent.Identifiers = append(ent.Identifiers, id)
	}
}
