package screening

import (
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SecondaryMatcher adjusts match scores based on secondary identifiers
// (DOB, nationality, ID numbers) to reduce false positives.
type SecondaryMatcher struct{}

func NewSecondaryMatcher() *SecondaryMatcher {
	return &SecondaryMatcher{}
}

// AdjustScore takes a match result and adjusts confidence based on secondary
// identifiers. Returns adjusted score clamped to [0, 1.0].
// Boosts:
//   - DOB exact match: +0.15
//   - DOB year-only match: +0.05
//   - Nationality overlap: +0.10
// Penalties:
//   - Nationality conflict (both have values, none match): -0.10
func (sm *SecondaryMatcher) AdjustScore(
	query domain.Entity,
	candidate domain.Entity,
	baseScore float64,
) float64 {
	score := baseScore

	// DOB adjustment
	score += sm.adjustDOB(query, candidate)

	// Nationality adjustment
	score += sm.adjustNationality(query, candidate)

	// Clamp to [0, 1.0]
	if score > 1.0 {
		return 1.0
	}
	if score < 0.0 {
		return 0.0
	}
	return score
}

func (sm *SecondaryMatcher) adjustDOB(q, c domain.Entity) float64 {
	if q.DOB == nil || c.DOB == nil {
		return 0.0
	}

	// Exact match: day, month, year all match
	if sm.dobsEqual(q.DOB, c.DOB) {
		return 0.15
	}

	// Year-only match: only year matches
	if q.DOB.Year() == c.DOB.Year() {
		return 0.05
	}

	// Both DOBs present but differ = no boost, no penalty
	return 0.0
}

func (sm *SecondaryMatcher) dobsEqual(dob1, dob2 *time.Time) bool {
	if dob1 == nil || dob2 == nil {
		return false
	}
	return dob1.Year() == dob2.Year() &&
		dob1.Month() == dob2.Month() &&
		dob1.Day() == dob2.Day()
}

func (sm *SecondaryMatcher) adjustNationality(q, c domain.Entity) float64 {
	// No nationalities = no adjustment
	if len(q.Nationalities) == 0 || len(c.Nationalities) == 0 {
		return 0.0
	}

	// Check for overlap
	for _, qNat := range q.Nationalities {
		for _, cNat := range c.Nationalities {
			if strings.EqualFold(qNat, cNat) {
				return 0.10
			}
		}
	}

	// Both have nationalities but none match = conflict
	return -0.10
}
