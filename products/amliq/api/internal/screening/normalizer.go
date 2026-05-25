package screening

import (
	"strings"
	"sync"
	"unicode"
)

// Normalizer strips punctuation + lowercases + collapses whitespace.
// The result is pure-function of input, so we memoize via sync.Map
// so the hot 6-layer cascade (4 name matchers + phonetic codes)
// only pays the rune-scan cost once per distinct string. Memory is
// bounded by the set of names the process has ever screened —
// acceptable for a long-lived API pod with a finite sanctions
// universe.
type Normalizer struct {
	cache sync.Map // map[string]string
}

// sharedNormalizer is used by every matcher so their caches collide
// and the same entity name normalized by exact/fuzzy/phonetic/token
// hits the same cache entry.
var sharedNormalizer = &Normalizer{}

func NewNormalizer() *Normalizer {
	return sharedNormalizer
}

func (n *Normalizer) Normalize(s string) string {
	if v, ok := n.cache.Load(s); ok {
		return v.(string)
	}
	out := normalizeString(s)
	n.cache.Store(s, out)
	return out
}

func normalizeString(s string) string {
	s = strings.ToLower(s)
	s = stripPunctuationString(s)
	s = normalizeWhitespaceString(s)
	s = reorderLastFirstString(s)
	return strings.TrimSpace(s)
}

// Public methods retained for backward compatibility with callers
// that use a Normalizer instance directly.
func (n *Normalizer) stripPunctuation(s string) string   { return stripPunctuationString(s) }
func (n *Normalizer) reorderLastFirst(s string) string   { return reorderLastFirstString(s) }
func (n *Normalizer) normalizeWhitespace(s string) string { return normalizeWhitespaceString(s) }

func stripPunctuationString(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsPunct(r) {
			return ' '
		}
		return r
	}, s)
}

// reorderLastFirstString handles "LASTNAME, FIRSTNAME ..." →
// "firstname lastname". Currently relies on stripPunctuation having
// already removed the comma, so this is a join+trim — kept as its
// own function so future reorder logic has a home.
func reorderLastFirstString(s string) string {
	parts := strings.Fields(s)
	return strings.Join(parts, " ")
}

func normalizeWhitespaceString(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	lastWasSpace := false
	for _, r := range s {
		if unicode.IsSpace(r) {
			if !lastWasSpace {
				b.WriteRune(' ')
				lastWasSpace = true
			}
		} else {
			b.WriteRune(r)
			lastWasSpace = false
		}
	}
	return b.String()
}
