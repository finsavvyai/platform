package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setUKPSCFields(ent *domain.Entity, rec []string, hdr headerIndex, typ domain.EntityType) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "uk_psc")
	if typ == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Date of birth
	if dob := norm(hdr.get(rec, "data.date_of_birth")); dob != "" {
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}

	// Notified date
	if notified := norm(hdr.get(rec, "data.notified_on", "notified_date")); notified != "" {
		setMeta(ent, "listing_date", notified)
	}

	// Address
	addr := joinSemi(
		norm(hdr.get(rec, "data.address.address_line_1")),
		norm(hdr.get(rec, "data.address.address_line_2")),
		norm(hdr.get(rec, "data.address.locality")),
		norm(hdr.get(rec, "data.address.postal_code")),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}

	// Nature of control (role/position)
	if noc := norm(hdr.get(rec, "data.natures_of_control")); noc != "" {
		setMeta(ent, "position", noc)
	}

	// Source URL
	setMeta(ent, "source_url", "https://download.companieshouse.gov.uk/en_pscdata.html")
}
