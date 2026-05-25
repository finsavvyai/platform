package ingestion

import (

	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichUKOFSIEntity adds UK OFSI-specific metadata and dataset.
func enrichUKOFSIEntity(
	ent *domain.Entity, rec []string, hdr headerIndex,
) {
	// Dataset
	setMeta(ent, "dataset", "uk_ofsi")

	// Schema type
	if ent.Type == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Extract and promote "Regime" as programs
	if regime := norm(hdr.get(rec, "Regime")); regime != "" {
		setMeta(ent, "programs", regime)
	}

	// "Listed On" as listing_date
	if listedOn := norm(hdr.get(rec, "Listed On")); listedOn != "" {
		setMeta(ent, "listing_date", listedOn)
	}

	// "Last Updated" as last_change
	if lastUpdated := norm(hdr.get(rec, "Last Updated")); lastUpdated != "" {
		setMeta(ent, "last_change", lastUpdated)
	}

	// "Other Information" as remarks
	if otherInfo := norm(hdr.get(rec, "Other Information")); otherInfo != "" {
		setMeta(ent, "remarks", otherInfo)
	}

	// UK sanctions list reference
	setMeta(ent, "source_url",
		"https://www.gov.uk/government/publications/the-uk-sanctions-list")
}
