package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichUNEntity adds UN-specific metadata fields.
func enrichUNEntity(ent *domain.Entity, m unMeta) {
	// Position from DESIGNATION field
	if m.designation != "" {
		setMeta(ent, "position", m.designation)
	}

	// Title field
	if m.title != "" {
		setMeta(ent, "title", m.title)
	}

	// Submitted by field
	if m.submittedBy != "" {
		setMeta(ent, "submitted_by", m.submittedBy)
	}

	// Dataset value
	setMeta(ent, "dataset", "un_sc_sanctions")

	// Schema type based on entity type
	if ent.Type == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Parse and set birth country from POBs
	if len(m.pobs) > 0 {
		for _, pob := range m.pobs {
			if c := strings.TrimSpace(pob.Country); c != "" {
				setMeta(ent, "birth_country", c)
				break
			}
		}
	}
}
