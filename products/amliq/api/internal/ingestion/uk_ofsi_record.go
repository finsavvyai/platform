package ingestion

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// parseUKOFSIRecord converts a single FCDO/OFSI CSV row into a domain
// Entity. Returns ok=false when the row lacks the minimum data (name +
// group id). Alias rows share the same Group ID with the primary row
// and are merged upstream via mergeUKOFSIAlias.
func parseUKOFSIRecord(rec []string, hdr headerIndex) (domain.Entity, bool) {
	firstName := norm(hdr.get(rec, "Name 1"))
	lastName := norm(hdr.get(rec, "Name 6"))
	if firstName == "" || lastName == "" {
		return domain.Entity{}, false
	}
	mid := joinNonEmpty(
		norm(hdr.get(rec, "Name 2")),
		norm(hdr.get(rec, "Name 3")),
		norm(hdr.get(rec, "Name 4")),
		norm(hdr.get(rec, "Name 5")),
	)
	fullName := joinNonEmpty(firstName, mid, lastName)
	normalized := NormalizeName(fullName)
	if normalized == "" {
		return domain.Entity{}, false
	}

	rawID := norm(hdr.get(rec, "OFSI Group ID", "Group ID", "Unique ID"))
	if rawID == "" {
		return domain.Entity{}, false
	}
	padded := fmt.Sprintf("%012s", rawID)
	padded = strings.ReplaceAll(padded, " ", "0")
	id, err := domain.NewEntityID("ent_" + padded)
	if err != nil {
		return domain.Entity{}, false
	}

	typ := domain.EntityTypeCompany
	kind := strings.ToLower(norm(hdr.get(rec, "Type of entity", "Group Type")))
	if strings.Contains(kind, "individual") {
		typ = domain.EntityTypeIndividual
	}

	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "uk_ofsi"
	setUKOFSIFields(&ent, rec, hdr)
	enrichUKOFSIEntity(&ent, rec, hdr)
	return ent, true
}
