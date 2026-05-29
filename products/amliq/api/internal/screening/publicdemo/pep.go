package publicdemo

import "strings"

// PEPLookup returns the PEPStatus for `name` against the supplied PEP
// list. Match priority:
//   1. exact (normalised) equality against primary_name → "match"
//   2. exact (normalised) equality against any alias  → "alias_match"
//   3. otherwise "none"
// Normalisation is lowercase + trimmed whitespace.
func PEPLookup(name string, peps FixtureList) PEPStatus {
	q := normalize(name)
	if q == "" {
		return PEPNone()
	}
	for _, e := range peps.Entries {
		if normalize(e.PrimaryName) == q {
			return PEPStatus{
				Status:   "match",
				Position: e.Position,
				Country:  e.Country,
				Tier:     e.Tier,
			}
		}
	}
	for _, e := range peps.Entries {
		for _, a := range e.Aliases {
			if normalize(a) == q {
				return PEPStatus{
					Status:   "alias_match",
					Position: e.Position,
					Country:  e.Country,
					Tier:     e.Tier,
				}
			}
		}
	}
	return PEPNone()
}

func normalize(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// applyPEPEnrichment fills the PEPStatus on every match. PEP lookup
// keys off the QUERY name (the entity being screened) rather than the
// matched candidate's name, because PEP status describes the subject,
// not the sanctions list entry. If the query itself resolves to a PEP
// entry, every match in the response carries that PEP signal.
func applyPEPEnrichment(query string, matches []Match, peps FixtureList) []Match {
	if len(matches) == 0 {
		return matches
	}
	queryStatus := PEPLookup(query, peps)
	if queryStatus.Status == "none" {
		return matches
	}
	for i := range matches {
		matches[i].PEPStatus = queryStatus
	}
	return matches
}

// pepOnlyMatch synthesises a single Match record for a query that has
// zero sanctions hits but does resolve to a PEP entry. This lets the
// public-demo response carry the PEP signal even when no sanctions
// candidate was scored.
func pepOnlyMatch(query string, peps FixtureList) (Match, bool) {
	status := PEPLookup(query, peps)
	if status.Status == "none" {
		return Match{}, false
	}
	entry, ok := findPEPEntry(query, peps)
	if !ok {
		return Match{}, false
	}
	return Match{
		EntityID:   sanitizeID(entry.EntityID),
		EntityName: entry.PrimaryName,
		Confidence: 0.0,
		Lists:      []string{"pep"},
		Layers:     []LayerResult{},
		PEPStatus:  status,
	}, true
}

func findPEPEntry(query string, peps FixtureList) (FixtureEntry, bool) {
	q := normalize(query)
	for _, e := range peps.Entries {
		if normalize(e.PrimaryName) == q {
			return e, true
		}
		for _, a := range e.Aliases {
			if normalize(a) == q {
				return e, true
			}
		}
	}
	return FixtureEntry{}, false
}
