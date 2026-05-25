package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setBISFields(ent *domain.Entity, rec []string, hdr headerIndex, typ domain.EntityType) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "us_bis_denied")
	if typ == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Effective date of denial
	if effDate := norm(hdr.get(rec, "Effective Date", "effective_date", "Date")); effDate != "" {
		setMeta(ent, "listing_date", effDate)
	}

	// Address
	addr := joinSemi(
		norm(hdr.get(rec, "Address", "address", "Street")),
		norm(hdr.get(rec, "City", "city")),
		norm(hdr.get(rec, "State", "state", "Province")),
		norm(hdr.get(rec, "Postal Code", "postal_code", "Zip")),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}

	// Reason for denial
	if reason := norm(hdr.get(rec, "Reason", "reason", "Action", "action")); reason != "" {
		setMeta(ent, "remarks", reason)
	}

	// License restrictions
	if license := norm(hdr.get(rec, "License Requirement", "license_requirement")); license != "" {
		setMeta(ent, "programs", license)
	}

	// Source URL
	setMeta(ent, "source_url", "https://www.bis.doc.gov/dpl/")
}
