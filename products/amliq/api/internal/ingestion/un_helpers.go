package ingestion

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// unMeta holds extracted metadata before applying to a domain.Entity.
type unMeta struct {
	aliases       []string
	dobs          []unDOB
	pobs          []unPOB
	nationalities []unNationality
	addresses     []unAddress
	documents     []unDocument
	program       string
	listedOn      string
	lastChange    string
	comments      string
	designation   string
	title         string
	submittedBy   string

	// Structured name parts — preserved so downstream search can
	// exact-match on given/family and render original-script.
	givenName      string
	familyName     string
	originalScript string
}

// buildUNEntity creates a domain.Entity from parsed UN XML data.
func buildUNEntity(
	rawID, normalized string,
	typ domain.EntityType,
	meta unMeta,
) (domain.Entity, bool) {
	if rawID == "" || len(rawID) < 4 {
		return domain.Entity{}, false
	}
	padded := fmt.Sprintf("%012s", rawID)
	padded = strings.ReplaceAll(padded, " ", "0")
	id, err := domain.NewEntityID("ent_" + padded)
	if err != nil {
		return domain.Entity{}, false
	}

	name, _ := domain.NewName(normalized,
		meta.givenName, meta.familyName, meta.originalScript)
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "un"
	applyUNMeta(&ent, meta)
	return ent, true
}

func applyUNMeta(ent *domain.Entity, m unMeta) {
	setMeta(ent, "program", m.program)
	setMeta(ent, "aliases", strings.Join(m.aliases, "; "))
	setMeta(ent, "listing_date", m.listedOn)
	setMeta(ent, "last_change", m.lastChange)
	setMeta(ent, "remarks", m.comments)
	dobStr := formatDOBs(m.dobs)
	setMeta(ent, "dob", dobStr)
	if dobStr != "" {
		parseDOB(ent, dobStr)
	}
	setMeta(ent, "birth_place", formatPOBs(m.pobs))
	setMeta(ent, "identifiers", formatDocuments(m.documents))
	ent.Identifiers = append(ent.Identifiers, unDocsToIdentifiers(m.documents)...)

	for _, n := range m.nationalities {
		if v := strings.TrimSpace(n.Value); v != "" {
			ent.Nationalities = append(ent.Nationalities, v)
		}
	}
	for _, a := range m.addresses {
		addr := joinNonEmpty(a.Street, a.City, a.StateProvince, a.Country)
		if addr != "" {
			ent.Addresses = append(ent.Addresses, addr)
		}
	}

	enrichUNEntity(ent, m)
	applyUNRich(ent, m)
}
