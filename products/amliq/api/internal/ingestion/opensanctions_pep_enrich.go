package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// buildPEPEntity constructs a richly-enriched Entity from a single
// OpenSanctions PEP simple.csv row. Populates name, DOB, nationalities,
// metadata (dataset, schemaType, firstSeen/lastSeen/lastChange, gender,
// birthPlace, position, pepTier, topics, source_url).
func buildPEPEntity(
	rec []string, hdr headerIndex,
) (domain.Entity, bool) {
	rawID := hdr.get(rec, "id")
	caption := hdr.get(rec, "name", "caption")
	if rawID == "" || caption == "" {
		return domain.Entity{}, false
	}
	id, err := domain.NewEntityID(sanitizeBulkID(rawID))
	if err != nil {
		return domain.Entity{}, false
	}
	n, _ := domain.NewName(caption, "", "", "")
	schema := hdr.get(rec, "schema")
	ent, err := domain.NewEntity(id, mapPEPType(schema), []domain.Name{n})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "opensanctions_peps"
	enrichPEPFromRow(&ent, rec, hdr)
	return ent, true
}

func enrichPEPFromRow(
	ent *domain.Entity, rec []string, hdr headerIndex,
) {
	if dob := hdr.get(rec, "birth_date", "birthDate"); dob != "" {
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}
	for _, c := range splitMulti(hdr.get(rec, "countries", "country")) {
		addUnique(&ent.Nationalities, c)
	}
	for _, a := range splitMulti(hdr.get(rec, "addresses")) {
		if a != "" {
			ent.Addresses = append(ent.Addresses, a)
		}
	}
	addPEPAliases(ent, hdr.get(rec, "aliases"))
	addPEPIdentifiers(ent, hdr.get(rec, "identifiers"))
	setMeta(ent, "dataset", hdr.get(rec, "dataset", "datasets"))
	setMeta(ent, "schemaType", hdr.get(rec, "schema"))
	setMeta(ent, "first_seen", hdr.get(rec, "first_seen"))
	setMeta(ent, "last_seen", hdr.get(rec, "last_seen"))
	setMeta(ent, "last_change", hdr.get(rec, "last_change"))
	setMeta(ent, "emails", hdr.get(rec, "emails"))
	setMeta(ent, "phones", hdr.get(rec, "phones"))
	setMeta(ent, "source_url", hdr.get(rec, "source_url", "sourceUrl"))
	props := parseProperties(hdr.get(rec, "properties"))
	if len(props) > 0 {
		enrichPEPFromProps(ent, props)
	}
}

// mapPEPType maps OpenSanctions schema to our EntityType.
func mapPEPType(schema string) domain.EntityType {
	switch strings.ToLower(schema) {
	case "company", "organization", "legalentity":
		return domain.EntityTypeCompany
	default:
		return domain.EntityTypeIndividual
	}
}
