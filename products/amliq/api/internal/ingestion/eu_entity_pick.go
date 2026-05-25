package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// pickPrimaryName selects the best name, preferring Latin script.
func (a *euEntityAgg) pickPrimaryName() string {
	for _, wn := range a.wholeNames {
		if containsLatinLetter(wn) {
			return wn
		}
	}
	if len(a.wholeNames) > 0 {
		return a.wholeNames[0]
	}
	composed := joinNonEmpty(
		firstOf(a.firstNames), firstOf(a.middleNames), firstOf(a.lastNames),
	)
	if composed != "" {
		return composed
	}
	return joinNonEmpty(firstOf(a.lastNames), firstOf(a.firstNames))
}

// guessEntityType returns Individual if Subject_type contains "P".
func (a *euEntityAgg) guessEntityType() domain.EntityType {
	for _, st := range a.subjectTypes {
		if st == "P" {
			return domain.EntityTypeIndividual
		}
	}
	return domain.EntityTypeCompany
}
