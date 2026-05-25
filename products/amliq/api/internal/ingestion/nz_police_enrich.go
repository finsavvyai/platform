package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setNZPoliceFields(ent *domain.Entity, entry nzPoliceEntry, typ domain.EntityType) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "nz_police_terror")
	if typ == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Aliases
	if entry.Aliases != "" {
		setMeta(ent, "aliases", entry.Aliases)
	}

	// Date of birth
	if entry.DateOfBirth != "" {
		setMeta(ent, "dob", entry.DateOfBirth)
		parseDOB(ent, entry.DateOfBirth)
	}

	// Listed / designation date
	if entry.ListedDate != "" {
		setMeta(ent, "listing_date", entry.ListedDate)
	}

	// Source URL
	setMeta(ent, "source_url", "https://www.police.govt.nz/advice/personal-community/counterterrorism/designated-entities")
}
