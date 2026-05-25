package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setEuropolFields(ent *domain.Entity, entry europolEntry) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "europol_wanted")
	setMeta(ent, "schemaType", "Person")

	// Date of birth
	if entry.DateOfBirth != "" {
		setMeta(ent, "dob", entry.DateOfBirth)
		parseDOB(ent, entry.DateOfBirth)
	}

	// Gender
	if entry.Gender != "" {
		setMeta(ent, "gender", entry.Gender)
	}

	// Offence as remarks/programs
	if entry.Offence != "" {
		setMeta(ent, "remarks", entry.Offence)
	}

	// Source URL
	setMeta(ent, "source_url", "https://eumostwanted.eu/")
}
