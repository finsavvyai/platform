package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// toEntity converts a UN INDIVIDUAL XML record to a domain.Entity.
func (ind *unIndividual) toEntity() (domain.Entity, bool) {
	names := extractUNNames(
		ind.FirstName, ind.SecondName, ind.ThirdName,
		ind.FourthName, ind.NameOrig, ind.Aliases,
	)
	primary := choosePrimaryLatinName(names)
	if primary == "" {
		return domain.Entity{}, false
	}
	normalized := NormalizeName(primary)
	if isOneWord(normalized) {
		return domain.Entity{}, false
	}
	meta := unMeta{
		aliases:        filterAliases(names, primary),
		dobs:           ind.DOBs,
		pobs:           ind.POBs,
		nationalities:  ind.Nationalities,
		addresses:      ind.Addresses,
		documents:      ind.Documents,
		program:        firstNonEmptyStr(ind.ListType),
		listedOn:       firstNonEmptyStr(ind.ListedOn, ind.LastUpdated),
		lastChange:     strings.TrimSpace(ind.LastUpdated),
		comments:       strings.TrimSpace(ind.Comments1),
		designation:    strings.TrimSpace(ind.Designation),
		title:          strings.TrimSpace(ind.Title),
		submittedBy:    strings.TrimSpace(ind.SubmittedBy),
		givenName:      strings.TrimSpace(ind.FirstName),
		familyName:     unJoinFamily(ind.SecondName, ind.ThirdName, ind.FourthName),
		originalScript: strings.TrimSpace(ind.NameOrig),
	}
	return buildUNEntity(
		firstNonEmptyStr(ind.DataID, ind.RefNumber, ind.ListType),
		normalized, domain.EntityTypeIndividual, meta,
	)
}
