package screening

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

const (
	boostDOBMatch         = 0.20
	boostNationalityMatch = 0.15
	boostIDMatch          = 0.25
	boostAddressCountry   = 0.10
	penaltyDOBConflict    = -0.15
	penaltyNatConflict    = -0.10
)

// MultiFactorScore adjusts a name score using additional entity attributes.
func MultiFactorScore(
	query, candidate domain.Entity,
	nameScore float64,
) float64 {
	score := nameScore
	score += dobAdjustment(query, candidate)
	score += nationalityAdjustment(query, candidate)
	score += identifierAdjustment(query, candidate)
	score += addressAdjustment(query, candidate)
	return capScore(score)
}

func dobAdjustment(q, c domain.Entity) float64 {
	if q.DOB == nil || c.DOB == nil {
		return 0
	}
	if q.DOB.Year() == c.DOB.Year() &&
		q.DOB.Month() == c.DOB.Month() &&
		q.DOB.Day() == c.DOB.Day() {
		return boostDOBMatch
	}
	// DOBs both present but differ → contradiction
	return penaltyDOBConflict
}

func nationalityAdjustment(q, c domain.Entity) float64 {
	if len(q.Nationalities) == 0 || len(c.Nationalities) == 0 {
		return 0
	}
	for _, qn := range q.Nationalities {
		for _, cn := range c.Nationalities {
			if strings.EqualFold(qn, cn) {
				return boostNationalityMatch
			}
		}
	}
	// Both have nationalities but none match → contradiction
	return penaltyNatConflict
}

func identifierAdjustment(q, c domain.Entity) float64 {
	if len(q.Identifiers) == 0 || len(c.Identifiers) == 0 {
		return 0
	}
	for _, qi := range q.Identifiers {
		for _, ci := range c.Identifiers {
			if qi.Type == ci.Type &&
				strings.EqualFold(qi.Value, ci.Value) {
				return boostIDMatch
			}
		}
	}
	return 0
}

func addressAdjustment(q, c domain.Entity) float64 {
	if len(q.Addresses) == 0 || len(c.Addresses) == 0 {
		return 0
	}
	for _, qa := range q.Addresses {
		for _, ca := range c.Addresses {
			if strings.EqualFold(qa, ca) {
				return boostAddressCountry
			}
		}
	}
	return 0
}

func capScore(score float64) float64 {
	if score > 1.0 {
		return 1.0
	}
	if score < 0.0 {
		return 0.0
	}
	return score
}
