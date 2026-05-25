package screening

import (
	"strings"
	"unicode"

	"github.com/aegis-aml/aegis/internal/domain"
	"golang.org/x/text/unicode/norm"
)

// exactIndex maps normalized names to entity IDs for O(1) lookup.
type exactIndex struct {
	nameMap map[string][]domain.EntityID
}

// buildExact constructs the exact name hash map.
func buildExact(entities []domain.Entity) exactIndex {
	idx := exactIndex{nameMap: make(map[string][]domain.EntityID)}
	for _, e := range entities {
		for _, n := range e.Names {
			key := normalizeExact(n.Full)
			if key != "" {
				idx.nameMap[key] = append(idx.nameMap[key], e.ID)
			}
		}
	}
	return idx
}

// lookup returns entity IDs matching the normalized query exactly.
func (ei exactIndex) lookup(query string) []domain.EntityID {
	key := normalizeExact(query)
	if key == "" {
		return nil
	}
	return ei.nameMap[key]
}

// normalizeExact lowercases, trims, strips accents and punctuation.
func normalizeExact(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ToLower(s)
	s = stripAccents(s)
	s = stripPunct(s)
	return collapseSpaces(s)
}

// stripAccents removes diacritical marks via NFD decomposition.
func stripAccents(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range norm.NFD.String(s) {
		if !unicode.Is(unicode.Mn, r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// stripPunct replaces punctuation with spaces.
func stripPunct(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsPunct(r) || unicode.IsSymbol(r) {
			return ' '
		}
		return r
	}, s)
}

// collapseSpaces reduces multiple spaces to single space.
func collapseSpaces(s string) string {
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}
