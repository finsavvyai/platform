package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichBulkFromProps extracts fields from the OpenSanctions
// JSON properties blob into Entity fields and Metadata.
func enrichBulkFromProps(ent *domain.Entity, props map[string][]string) {
	if dob := firstSlice(props["birthDate"]); dob != "" {
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}
	for _, n := range props["nationality"] {
		addUnique(&ent.Nationalities, strings.TrimSpace(n))
	}
	if c := firstSlice(props["country"]); c != "" {
		setMeta(ent, "country", c)
		addUnique(&ent.Nationalities, c)
	}
	setBulkScalars(ent, props)
	setBulkContact(ent, props)
	setBulkAddresses(ent, props)
	setBulkIdentifiers(ent, props)
	setPepTier(ent, props["topics"])
}

// enrichBulkFromHeader promotes header-level columns into Metadata.
func enrichBulkFromHeader(
	ent *domain.Entity, hdr headerIndex, rec []string,
) {
	setMeta(ent, "first_seen", hdr.get(rec, "first_seen"))
	setMeta(ent, "last_seen", hdr.get(rec, "last_seen"))
	setMeta(ent, "last_change", hdr.get(rec, "last_change"))
	setMeta(ent, "dataset", hdr.get(rec, "dataset", "datasets"))
	setMeta(ent, "schemaType", hdr.get(rec, "schema"))
}

func setBulkScalars(ent *domain.Entity, props map[string][]string) {
	scalars := map[string]string{
		"aliases":         joinSemi(props["alias"]...),
		"weak_aliases":    joinSemi(props["weakAlias"]...),
		"remarks":         firstSlice(props["notes"]),
		"birth_place":     firstSlice(props["birthPlace"]),
		"birth_country":   firstSlice(props["birthCountry"]),
		"death_date":      firstSlice(props["deathDate"]),
		"gender":          firstSlice(props["gender"]),
		"title":           firstSlice(props["title"]),
		"position":        joinSemi(props["position"]...),
		"occupation":      joinSemi(props["occupation"]...),
		"education":       joinSemi(props["education"]...),
		"religion":        firstSlice(props["religion"]),
		"ethnicity":       firstSlice(props["ethnicity"]),
		"languages":       joinSemi(props["languages"]...),
		"source_url":      firstSlice(props["sourceUrl"]),
		"summary":         firstSlice(props["summary"]),
		"programs":        joinSemi(props["program"]...),
		"sanctions":       joinSemi(props["sanctions"]...),
		"topics":          joinSemi(props["topics"]...),
		"status":          firstSlice(props["status"]),
		"jurisdiction":    firstSlice(props["jurisdiction"]),
		"legal_form":      firstSlice(props["legalForm"]),
		"mother_name":     firstSlice(props["motherName"]),
		"father_name":     firstSlice(props["fatherName"]),
		"registration_no": firstSlice(props["registrationNumber"]),
		"incorporation":   firstSlice(props["incorporationDate"]),
		"dissolution":     firstSlice(props["dissolutionDate"]),
	}
	for k, v := range scalars {
		setMeta(ent, k, v)
	}
	// Parse death-date so we can filter deceased individuals later.
	if dd := firstSlice(props["deathDate"]); dd != "" {
		if t := parseDateBestEffort(dd); !t.IsZero() {
			ent.Metadata["death_date_parsed"] = t.Format("2006-01-02")
		}
	}
}
