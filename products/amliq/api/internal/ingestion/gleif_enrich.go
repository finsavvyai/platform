package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func setGLEIFFields(ent *domain.Entity, rec gleifRecord) {
	setMeta(ent, "dataset", "gleif_lei")
	setMeta(ent, "schemaType", "Organization")

	if cat := rec.Attributes.Entity.Category; cat != "" {
		setMeta(ent, "position", cat)
	}
	if status := rec.Attributes.Entity.Status; status != "" {
		setMeta(ent, "remarks", "LEI Status: "+status)
	}
	if lf := rec.Attributes.Entity.LegalForm.ID; lf != "" {
		setMeta(ent, "legal_form", lf)
	}
	if regStatus := rec.Attributes.Registration.Status; regStatus != "" {
		setMeta(ent, "registration_status", regStatus)
	}

	// LEI as registration identifier
	lei := strings.TrimSpace(rec.ID)
	jurisdiction := strings.TrimSpace(rec.Attributes.Entity.Jurisdiction)
	if lei != "" {
		if id, err := domain.NewIdentifier(
			domain.IDRegistration, lei, jurisdiction,
		); err == nil {
			ent.Identifiers = append(ent.Identifiers, id)
		}
	}
	if jurisdiction != "" {
		addUnique(&ent.Nationalities, jurisdiction)
	}

	// HQ + legal addresses — push unique ones to ent.Addresses
	hq := formatGLEIFAddress(rec.Attributes.Entity.HeadquartersAddress)
	if hq != "" {
		ent.Addresses = append(ent.Addresses, hq)
	}
	legal := formatGLEIFAddress(rec.Attributes.Entity.LegalAddress)
	if legal != "" && legal != hq {
		ent.Addresses = append(ent.Addresses, legal)
	}

	setMeta(ent, "source_url", "https://www.gleif.org/")
}

// formatGLEIFAddress joins the address lines plus city/region/country/zip
// into a single canonical string. Returns "" when the block is empty.
func formatGLEIFAddress(a gleifAddress) string {
	parts := make([]string, 0, len(a.AddressLines)+4)
	for _, l := range a.AddressLines {
		if s := strings.TrimSpace(l); s != "" {
			parts = append(parts, s)
		}
	}
	for _, p := range []string{a.City, a.Region, a.PostalCode, a.Country} {
		if s := strings.TrimSpace(p); s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, ", ")
}
