package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setAdverseMediaFields(ent *domain.Entity, e extractedEntity, typ domain.EntityType) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "adverse_media")
	if typ == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Role/position from media extraction
	if e.Role != "" {
		setMeta(ent, "position", e.Role)
	}
}
