package ingestion

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// toEntity converts the aggregated EU entity data to a domain Entity.
func (a *euEntityAgg) toEntity() (domain.Entity, bool) {
	primary := a.pickPrimaryName()
	if primary == "" {
		return domain.Entity{}, false
	}
	normalized := NormalizeName(primary)
	if normalized == "" {
		return domain.Entity{}, false
	}

	padded := fmt.Sprintf("%012s", a.entityID)
	padded = strings.ReplaceAll(padded, " ", "0")
	id, err := domain.NewEntityID("ent_" + padded)
	if err != nil {
		return domain.Entity{}, false
	}

	typ := a.guessEntityType()
	first, last := firstOrEmpty(a.firstNames), firstOrEmpty(a.lastNames)
	name, _ := domain.NewName(normalized, first, last, "")
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}

	ent.ListID = "eu-fsf"
	// Add alias Names preserving first/last parts per alias row.
	for _, wn := range a.wholeNames {
		if wn == primary || wn == "" {
			continue
		}
		if alias, err := domain.NewName(wn, "", "", ""); err == nil {
			ent.Names = append(ent.Names, alias)
		}
	}
	a.setEntityFields(&ent)
	return ent, true
}

func firstOrEmpty(s []string) string {
	if len(s) == 0 {
		return ""
	}
	return s[0]
}

func (a *euEntityAgg) setEntityFields(ent *domain.Entity) {
	ent.Addresses = append(ent.Addresses, a.addresses...)
	ent.Nationalities = append(ent.Nationalities, a.nationalities...)

	setMeta(ent, "program", strings.Join(a.programs, ";"))
	setMeta(ent, "dob", a.birthDate)
	if a.birthDate != "" {
		parseDOB(ent, a.birthDate)
	}
	setMeta(ent, "birth_place", a.birthPlace)
	setMeta(ent, "birth_country", a.birthCountry)
	setMeta(ent, "identifiers", strings.Join(a.identifiers, ";"))
	setMeta(ent, "source_url", a.listURL)
	setMeta(ent, "first_seen", a.pubDate)
	setMeta(ent, "last_seen", a.dateFile)

	// Aliases: all whole names except primary
	primary := a.pickPrimaryName()
	var aliases []string
	for _, wn := range a.wholeNames {
		if wn != primary && wn != "" {
			aliases = append(aliases, wn)
		}
	}
	setMeta(ent, "aliases", strings.Join(aliases, ";"))

	// Promote additional info as remarks — prefer Entity_remark
	// when present, append Addr_other lines as extra context.
	var remarks []string
	if a.remark != "" {
		remarks = append(remarks, a.remark)
	}
	remarks = append(remarks, a.additionalInfo...)
	if len(remarks) > 0 {
		setMeta(ent, "remarks", strings.Join(remarks, "; "))
	}

	// Person-level Naal_* attributes (gender/title/function/language).
	setMeta(ent, "gender", a.gender)
	setMeta(ent, "title", a.title)
	setMeta(ent, "function", a.function)
	setMeta(ent, "language", a.language)

	enrichEUEntity(ent, a)
	applyEURich(ent, a)
}

