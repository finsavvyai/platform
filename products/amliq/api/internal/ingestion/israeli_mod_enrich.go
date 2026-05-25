package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setIsraeliMoDFields(ent *domain.Entity, record []string) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "il_mod")
	setMeta(ent, "schemaType", "Person")

	// Extract additional columns if present (typically: ID, Name, Org, Date, etc.)
	if len(record) > 2 {
		if org := norm(record[2]); org != "" {
			setMeta(ent, "position", org)
		}
	}
	if len(record) > 3 {
		if date := norm(record[3]); date != "" {
			setMeta(ent, "listing_date", date)
		}
	}

	// Source URL for Israeli MoD
	setMeta(ent, "source_url", "https://nbctf.mod.gov.il/he/Sanctions/Lists")
}
