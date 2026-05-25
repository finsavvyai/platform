package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// buildGLEIFXMLEntity turns one parsed LEIRecord into a domain Entity
// with the richer fields the CSV API path can't carry: jurisdiction,
// category, full legal address, registration dates.
func buildGLEIFXMLEntity(rec gleifXMLRecord) (domain.Entity, bool) {
	name := strings.TrimSpace(rec.Entity.LegalName)
	if name == "" || len(name) < 3 || rec.LEI == "" {
		return domain.Entity{}, false
	}
	id, err := domain.NewEntityID(sanitizeBulkID("lei_" + rec.LEI))
	if err != nil {
		return domain.Entity{}, false
	}
	n, _ := domain.NewName(NormalizeName(name), "", "", "")
	ent, err := domain.NewEntity(id, domain.EntityTypeCompany, []domain.Name{n})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "gleif_lei"
	setMeta(&ent, "dataset", "gleif_lei")
	setMeta(&ent, "lei", rec.LEI)
	setMeta(&ent, "jurisdiction", rec.Entity.Jurisdiction)
	setMeta(&ent, "entity_category", rec.Entity.Category)
	setMeta(&ent, "registration_status", rec.Registration.Status)
	setMeta(&ent, "registration_initial", rec.Registration.InitialDate)
	setMeta(&ent, "registration_last_update", rec.Registration.LastUpdateDate)
	setMeta(&ent, "source_url", "https://www.gleif.org/")
	addr := joinNonEmpty(
		strings.TrimSpace(rec.Entity.LegalAddress.FirstAddressLine),
		strings.TrimSpace(rec.Entity.LegalAddress.City),
		strings.TrimSpace(rec.Entity.LegalAddress.PostalCode),
		strings.TrimSpace(rec.Entity.LegalAddress.Country),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}
	if c := strings.TrimSpace(rec.Entity.LegalAddress.Country); c != "" {
		addUnique(&ent.Nationalities, c)
	}
	return ent, true
}
