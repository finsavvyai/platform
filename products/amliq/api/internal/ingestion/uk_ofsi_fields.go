package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// setUKOFSIFields populates address, nationality, and metadata.
func setUKOFSIFields(
	ent *domain.Entity, rec []string, hdr headerIndex,
) {
	addr := joinNonEmpty(
		norm(hdr.get(rec, "Address 1")),
		norm(hdr.get(rec, "Address 2")),
		norm(hdr.get(rec, "Address 3")),
		norm(hdr.get(rec, "Address 4")),
		norm(hdr.get(rec, "Address 5")),
		norm(hdr.get(rec, "Address 6")),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}
	if nat := norm(hdr.get(rec, "Nationality")); nat != "" {
		ent.Nationalities = append(ent.Nationalities, nat)
	}

	dobStr := norm(hdr.get(rec, "DOB"))
	setMeta(ent, "dob", dobStr)
	if dobStr != "" {
		parseDOB(ent, dobStr)
	}

	// Birth place + country
	townOfBirth := norm(hdr.get(rec, "Town of Birth"))
	countryOfBirth := norm(hdr.get(rec, "Country of Birth"))
	birthPlace := joinNonEmpty(townOfBirth, countryOfBirth)
	setMeta(ent, "birth_place", birthPlace)
	if ent.PlaceOfBirth == "" {
		ent.PlaceOfBirth = birthPlace
	}

	// Passport (current header uses "Passport Number"; older format
	// used "Passport Details" — accept either).
	if passport := norm(hdr.get(rec, "Passport Number", "Passport Details")); passport != "" {
		id, _ := domain.NewIdentifier(domain.IDPassport, passport, "")
		ent.Identifiers = append(ent.Identifiers, id)
		setMeta(ent, "passport", passport)
	}

	// National ID (current header uses "National Identification Number";
	// older format used "NI Number").
	if ni := norm(hdr.get(rec, "National Identification Number", "NI Number")); ni != "" {
		id, _ := domain.NewIdentifier(domain.IDNationalID, ni, "GB")
		ent.Identifiers = append(ent.Identifiers, id)
		setMeta(ent, "ni_number", ni)
	}

	// Position
	if pos := norm(hdr.get(rec, "Position")); pos != "" {
		setMeta(ent, "position", pos)
		if ent.PositionTitle == "" {
			ent.PositionTitle = pos
		}
	}

	// Alias type
	if aliasType := norm(hdr.get(rec, "Alias Type")); aliasType != "" {
		setMeta(ent, "aliases", aliasType)
	}
}
