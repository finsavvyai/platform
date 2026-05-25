package screening

import (
	"fmt"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// TryBoost checks if a match is obvious enough to skip AI explanation.
// Returns true + explanation if boosted, false + empty string otherwise.
// Exact name (normalized) + exact DOB + same country = obvious match.
func TryBoost(
	entity domain.Entity,
	candidate domain.Entity,
) (bool, string) {
	if !namesMatch(entity, candidate) {
		return false, ""
	}
	if !dobMatch(entity.DOB, candidate.DOB) {
		return false, ""
	}
	if !countryMatch(entity.Nationalities, candidate.Nationalities) {
		return false, ""
	}
	explanation := fmt.Sprintf(
		"Exact match: %q matches %q on list %s "+
			"(name, DOB, and country all match exactly)",
		entity.PrimaryName().Full,
		candidate.PrimaryName().Full,
		candidate.ListID,
	)
	return true, explanation
}

func namesMatch(a, b domain.Entity) bool {
	if len(a.Names) == 0 || len(b.Names) == 0 {
		return false
	}
	return normalizeName(a.PrimaryName().Full) ==
		normalizeName(b.PrimaryName().Full)
}

func normalizeName(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

func dobMatch(a, b *time.Time) bool {
	if a == nil || b == nil {
		return false
	}
	return a.Year() == b.Year() &&
		a.Month() == b.Month() &&
		a.Day() == b.Day()
}

func countryMatch(a, b []string) bool {
	if len(a) == 0 || len(b) == 0 {
		return false
	}
	set := make(map[string]bool, len(a))
	for _, c := range a {
		set[strings.ToLower(strings.TrimSpace(c))] = true
	}
	for _, c := range b {
		if set[strings.ToLower(strings.TrimSpace(c))] {
			return true
		}
	}
	return false
}
