package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// enrichNBCTFIDs extracts national-ID and company-registration
// identifiers from header-based records.
func enrichNBCTFIDs(
	ent *domain.Entity, rec []string, hdr headerIndex,
) {
	idNum := hdr.get(rec, "ID Number", "Identity Number", "ID")
	if idNum != "" {
		id, err := domain.NewIdentifier(domain.IDNationalID, idNum, "IL")
		if err == nil {
			ent.Identifiers = append(ent.Identifiers, id)
		}
	}

	compReg := hdr.get(rec,
		"Company Registration Number",
		"Registration Number",
		"Corp Number")
	if compReg != "" {
		id, err := domain.NewIdentifier(domain.IDRegistration, compReg, "IL")
		if err == nil {
			ent.Identifiers = append(ent.Identifiers, id)
		}
	}
}

// enrichNBCTFAddress builds a single-line address string from
// header-based columns and appends it to the entity.
func enrichNBCTFAddress(
	ent *domain.Entity, rec []string, hdr headerIndex,
) {
	addr := joinNonEmpty(
		hdr.get(rec, "Street 1", "Street"),
		hdr.get(rec, "Street 2"),
		hdr.get(rec, "Building", "Building Number"),
		hdr.get(rec, "Floor"),
		hdr.get(rec, "City"),
		hdr.get(rec, "Postal Code", "Zip"),
		hdr.get(rec, "Country"),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}

	ent.Nationalities = []string{"IL"}
}
