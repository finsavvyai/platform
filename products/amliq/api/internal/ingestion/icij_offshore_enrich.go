package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setICIJFields(ent *domain.Entity, rec []string, hdr headerIndex, typ domain.EntityType) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "icij_offshore")
	if typ == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Address
	if addr := norm(hdr.get(rec, "address")); addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}

	// Incorporation date
	if incDate := norm(hdr.get(rec, "incorporation_date")); incDate != "" {
		setMeta(ent, "listing_date", incDate)
	}

	// Linked entities/relationships
	if related := norm(hdr.get(rec, "related_entities")); related != "" {
		setMeta(ent, "remarks", related)
	}

	// Source / dataset origin
	sourceDataset := norm(hdr.get(rec, "dataset", "datasets"))
	if sourceDataset != "" {
		setMeta(ent, "programs", sourceDataset)
	}

	// Source URL for ICIJ data
	setMeta(ent, "source_url", "https://offshoreleaks.icij.org/")
}
