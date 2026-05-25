package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// enrichNBCTFFromHeaders populates metadata, identifiers, and
// addresses for entities parsed via the header-based path (new CSV
// format + XML). Mirrors what setNBCTFFields does for index-based
// records.
func enrichNBCTFFromHeaders(
	ent *domain.Entity, rec []string, hdr headerIndex,
) {
	setMeta(ent, "dataset", "il_nbctf")
	if ent.Type == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Aliases (AKA + nickname columns)
	aliases := joinSemi(
		hdr.get(rec, "AKA - English", "Alias - English"),
		hdr.get(rec, "Nickname - English", "Nick - English"),
		hdr.get(rec, "AKA - Hebrew", "Alias - Hebrew"),
		hdr.get(rec, "Nickname - Hebrew", "Nick - Hebrew"),
	)
	setMeta(ent, "aliases", aliases)

	// Date of birth
	dob := hdr.get(rec, "Date of Birth", "DOB", "Birth Date")
	setMeta(ent, "dob", dob)
	if dob != "" {
		parseDOB(ent, dob)
	}

	// Designation / program
	setMeta(ent, "program", hdr.get(rec,
		"Designated Organization - English",
		"Organization - English",
		"Organization Name - English"))

	// Phones & emails
	setMeta(ent, "phones", joinSemi(
		hdr.get(rec, "Phone 1", "Phone"),
		hdr.get(rec, "Phone 2"),
	))
	setMeta(ent, "emails", joinSemi(
		hdr.get(rec, "Email 1", "Email"),
	))

	enrichNBCTFIDs(ent, rec, hdr)
	enrichNBCTFAddress(ent, rec, hdr)

	setMeta(ent, "source_url",
		"https://nbctf.mod.gov.il/he/Sanctions/Lists")
}
