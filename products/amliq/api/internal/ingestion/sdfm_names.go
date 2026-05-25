package ingestion

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// toEntity converts a SDFM XML record to a domain.Entity.
func (r *sdfmRecord) toEntity() (domain.Entity, bool) {
	primary, aliases := r.resolveNames()
	if primary == "" {
		return domain.Entity{}, false
	}
	normalized := NormalizeName(primary)
	if normalized == "" || isOneWord(normalized) {
		return domain.Entity{}, false
	}

	listID := strings.TrimSpace(r.NumberEntry)
	if listID == "" {
		return domain.Entity{}, false
	}
	padded := fmt.Sprintf("%012s", listID)
	padded = strings.ReplaceAll(padded, " ", "0")
	id, err := domain.NewEntityID("ent_" + padded)
	if err != nil {
		return domain.Entity{}, false
	}

	typ := domain.EntityTypeIndividual
	if strings.TrimSpace(r.TypeEntry) == "1" {
		typ = domain.EntityTypeCompany
	}

	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "sdfm"
	enrichSDFM(&ent, r, aliases)
	return ent, true
}

// resolveNames extracts primary name and aliases from aka-list.
// type-aka "N" = primary; others = aliases.
func (r *sdfmRecord) resolveNames() (string, []string) {
	var primary string
	var aliases []string

	for _, aka := range r.AkaList {
		composed := composeAkaName(aka)
		if composed == "" {
			continue
		}
		if strings.TrimSpace(aka.Type) == "N" && primary == "" {
			primary = composed
		} else {
			aliases = append(aliases, composed)
		}
	}

	// Fallback: use first alias as primary, keep all as aliases
	if primary == "" && len(aliases) > 0 {
		primary = aliases[0]
	}
	return primary, aliases
}

func composeAkaName(aka sdfmAka) string {
	return joinNonEmpty(
		strings.TrimSpace(aka.Name1),
		strings.TrimSpace(aka.Name2),
		strings.TrimSpace(aka.Name3),
		strings.TrimSpace(aka.Name4),
	)
}
