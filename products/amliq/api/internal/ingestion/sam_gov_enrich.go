package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setSAMGovFields(ent *domain.Entity, rec []string, hdr headerIndex, typ domain.EntityType) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "us_sam_exclusions")
	if typ == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Exclusion effective date
	if effDate := norm(hdr.get(rec, "Effective Date", "effective_date")); effDate != "" {
		setMeta(ent, "listing_date", effDate)
	}

	// Address
	addr := joinSemi(
		norm(hdr.get(rec, "Address")),
		norm(hdr.get(rec, "City")),
		norm(hdr.get(rec, "State/Province")),
		norm(hdr.get(rec, "Zip")),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}

	// Exclusion reason
	if reason := norm(hdr.get(rec, "Reason", "reason", "Exclusion Reason")); reason != "" {
		setMeta(ent, "remarks", reason)
	}

	// Source URL
	setMeta(ent, "source_url", "https://sam.gov/content/exclusions")
}
