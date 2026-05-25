package ingestion

import (

	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichEUEntity adds EU-specific metadata and fields.
func enrichEUEntity(ent *domain.Entity, a *euEntityAgg) {
	// Dataset
	setMeta(ent, "dataset", "eu_fsf")

	// Schema type
	if ent.Type == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Listing date (prefer explicit field over pubDate)
	if a.listingDate != "" {
		setMeta(ent, "listing_date", a.listingDate)
	} else if a.pubDate != "" {
		setMeta(ent, "listing_date", a.pubDate)
	}

	// Regulation number
	if a.regulationNumber != "" {
		setMeta(ent, "regulation_number", a.regulationNumber)
	}

	// Add identifier type info if available
	if a.identifierType != "" {
		setMeta(ent, "identifier_type", a.identifierType)
	}
}
