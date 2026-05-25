package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

// addPEPAliases expands the simple.csv `aliases` cell into additional
// domain.Name entries on the entity. The primary name is preserved;
// duplicates of the primary are skipped.
func addPEPAliases(ent *domain.Entity, raw string) {
	if raw == "" {
		return
	}
	setMeta(ent, "aliases", raw)
	primary := ""
	if len(ent.Names) > 0 {
		primary = ent.Names[0].Full
	}
	for _, a := range splitMulti(raw) {
		if a == "" || a == primary {
			continue
		}
		if n, err := domain.NewName(a, "", "", ""); err == nil {
			ent.Names = append(ent.Names, n)
		}
	}
}

// addPEPIdentifiers parses the simple.csv `identifiers` cell (a
// semi/comma-delimited list of stringified IDs) into typed
// domain.Identifier entries. Type is left unspecified since the simple
// export strips the IdentifierType schema.
func addPEPIdentifiers(ent *domain.Entity, raw string) {
	if raw == "" {
		return
	}
	for _, v := range splitMulti(raw) {
		if v == "" {
			continue
		}
		id, err := domain.NewIdentifier(
			domain.IdentifierType("opensanctions"), v, "")
		if err != nil {
			continue
		}
		ent.Identifiers = append(ent.Identifiers, id)
	}
}
