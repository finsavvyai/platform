package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setHKHKMAFields(ent *domain.Entity, rec []string, hdr headerIndex, typ domain.EntityType) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "hk_hkma")
	if typ == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Date of birth
	if dob := norm(hdr.get(rec, "Date of Birth", "dob", "DOB")); dob != "" {
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}

	// Listing date / designation
	if listDate := norm(hdr.get(rec, "Listing Date", "listing_date", "Designated Date")); listDate != "" {
		setMeta(ent, "listing_date", listDate)
	}

	// Address
	if addr := norm(hdr.get(rec, "Address", "address")); addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}

	// Reason for listing
	if reason := norm(hdr.get(rec, "Reason", "reason", "Remarks")); reason != "" {
		setMeta(ent, "remarks", reason)
	}

	// Source URL
	setMeta(ent, "source_url", "https://www.hkma.gov.hk/eng/regulatory-resources/")
}
