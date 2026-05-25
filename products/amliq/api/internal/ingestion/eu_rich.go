package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// applyEURich populates ent.Identifiers and ent.Names[1:] from the
// EU aggregate so the rich JSONB columns are filled. Without this,
// every EU FSF row lands with NULL identifiers/aliases despite the
// source CSV containing both columns.
func applyEURich(ent *domain.Entity, a *euEntityAgg) {
	addEUIdentifiers(ent, a)
	addEUAliasNames(ent, a)
}

func addEUIdentifiers(ent *domain.Entity, a *euEntityAgg) {
	typ := mapEUIDType(a.identifierType)
	for _, raw := range a.identifiers {
		num, country := splitEUIDValue(raw, a.identifierCountry)
		if num == "" {
			continue
		}
		id, err := domain.NewIdentifier(typ, num, country)
		if err != nil {
			continue
		}
		ent.Identifiers = append(ent.Identifiers, id)
	}
}

func addEUAliasNames(ent *domain.Entity, a *euEntityAgg) {
	primary := a.pickPrimaryName()
	seen := map[string]bool{primary: true}
	for _, wn := range a.wholeNames {
		wn = strings.TrimSpace(wn)
		if wn == "" || seen[wn] {
			continue
		}
		if n, err := domain.NewName(wn, "", "", ""); err == nil {
			ent.Names = append(ent.Names, n)
			seen[wn] = true
		}
	}
}

// splitEUIDValue undoes the "value (country)" formatting that
// eu_entity_agg uses internally and returns the bare value plus
// extracted country, falling back to the agg-level country.
func splitEUIDValue(raw, fallback string) (string, string) {
	raw = strings.TrimSpace(raw)
	if i := strings.LastIndex(raw, "("); i > 0 && strings.HasSuffix(raw, ")") {
		country := strings.TrimSpace(raw[i+1 : len(raw)-1])
		return strings.TrimSpace(raw[:i]), country
	}
	return raw, strings.TrimSpace(fallback)
}

func mapEUIDType(raw string) domain.IdentifierType {
	lower := strings.ToLower(strings.TrimSpace(raw))
	switch {
	case strings.Contains(lower, "passport"):
		return domain.IDPassport
	case strings.Contains(lower, "national"),
		strings.Contains(lower, "identity"):
		return domain.IDNationalID
	case strings.Contains(lower, "tax"):
		return domain.IDTaxID
	default:
		return domain.IDRegistration
	}
}
