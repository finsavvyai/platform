package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichSECOEntity adds SECO-specific metadata.
func enrichSECOEntity(ent *domain.Entity) {
	// Dataset: Swiss SECO sanctions
	setMeta(ent, "dataset", "ch_seco")

	// Schema type based on entity type
	if ent.Type == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Source URL for Swiss SECO
	setMeta(ent, "source_url",
		"https://www.sesam.search.admin.ch/sesam-search-web/pages/searchDatabase.xhtml")
}
