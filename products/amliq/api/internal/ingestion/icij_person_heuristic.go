package ingestion

import "strings"

// looksLikePerson checks if name has person-like patterns
// (used by ICIJ + Israeli Treasury to disambiguate person vs company).
func looksLikePerson(name string) bool {
	parts := strings.Fields(name)
	if len(parts) < 2 || len(parts) > 5 {
		return false
	}
	upper := strings.ToUpper(name)
	if name == upper {
		return false
	}
	for _, suffix := range []string{
		"Ltd", "LLC", "Inc", "Corp", "SA", "AG", "GmbH",
		"Limited", "Foundation", "Trust", "Fund",
	} {
		if strings.Contains(name, suffix) {
			return false
		}
	}
	return true
}
