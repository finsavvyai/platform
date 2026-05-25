package screening

import (
	"strings"

	"github.com/cloudflare/ahocorasick"
)

// AhoCorasickIndex provides O(n+m+z) multi-pattern matching against
// all sanctions names in a single pass. Used as the fastest exact tier.
type AhoCorasickIndex struct {
	matcher  *ahocorasick.Matcher
	patterns []string     // index-aligned with matcher
	entityID []string     // pattern index → entity ID
	entCount int
}

// NewAhoCorasickIndex builds an Aho-Corasick automaton from entity names.
// Build time: O(sum of all pattern lengths). Query: O(input_len + matches).
func NewAhoCorasickIndex(entities []entityPattern) *AhoCorasickIndex {
	patterns := make([]string, 0, len(entities)*2)
	entityIDs := make([]string, 0, len(entities)*2)

	for _, ep := range entities {
		// Add normalized form
		norm := strings.ToLower(strings.TrimSpace(ep.Name))
		if norm == "" {
			continue
		}
		patterns = append(patterns, norm)
		entityIDs = append(entityIDs, ep.EntityID)

		// Add individual words for partial matching
		words := strings.Fields(norm)
		if len(words) > 1 {
			for _, w := range words {
				if len(w) > 3 {
					patterns = append(patterns, w)
					entityIDs = append(entityIDs, ep.EntityID)
				}
			}
		}
	}

	m := ahocorasick.NewStringMatcher(patterns)

	return &AhoCorasickIndex{
		matcher:  m,
		patterns: patterns,
		entityID: entityIDs,
		entCount: len(entities),
	}
}

// entityPattern is a simple name→entityID pair for building the index.
type entityPattern struct {
	Name     string
	EntityID string
}

// ACMatch represents a match from the Aho-Corasick automaton.
type ACMatch struct {
	Pattern  string
	EntityID string
	FullName bool // true if matched full name, false if partial word
}

// Search runs the automaton against the input name.
// Returns all matching sanctions entries in O(input_len + matches).
func (ac *AhoCorasickIndex) Search(name string) []ACMatch {
	norm := strings.ToLower(strings.TrimSpace(name))
	if norm == "" {
		return nil
	}

	hits := ac.matcher.Match([]byte(norm))
	if len(hits) == 0 {
		return nil
	}

	// Deduplicate by entityID
	seen := make(map[string]bool, len(hits))
	var results []ACMatch
	for _, idx := range hits {
		if idx >= len(ac.entityID) {
			continue
		}
		eid := ac.entityID[idx]
		if seen[eid] {
			continue
		}
		seen[eid] = true
		isFullName := ac.patterns[idx] == norm ||
			strings.Contains(norm, ac.patterns[idx])
		results = append(results, ACMatch{
			Pattern:  ac.patterns[idx],
			EntityID: eid,
			FullName: isFullName,
		})
	}
	return results
}

// PatternCount returns the number of patterns in the automaton.
func (ac *AhoCorasickIndex) PatternCount() int { return len(ac.patterns) }

// EntityCount returns the number of unique entities indexed.
func (ac *AhoCorasickIndex) EntityCount() int { return ac.entCount }
