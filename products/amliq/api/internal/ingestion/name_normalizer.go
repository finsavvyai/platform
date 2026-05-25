package ingestion

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	unorm "golang.org/x/text/unicode/norm"
)

const maxNameBytes = 254

// NormalizeName strips accents, removes non-alphanumeric chars,
// and limits to 254 bytes. Preserves all Unicode scripts (Arabic,
// Hebrew, Cyrillic, CJK, etc.).
func NormalizeName(s string) string {
	s = stripAccents(s)
	s = cleanNonAlphanumeric(s)
	s = collapseWhitespace(s)
	s = truncateBytes(s, maxNameBytes)
	return strings.TrimSpace(s)
}

func stripAccents(s string) string {
	t := transform.Chain(
		unorm.NFD,
		runes.Remove(runes.In(unicode.Mn)),
		unorm.NFC,
	)
	result, _, _ := transform.String(t, s)
	return result
}

func cleanNonAlphanumeric(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) ||
			unicode.IsSpace(r) || isPreserved(r) {
			b.WriteRune(r)
		} else {
			b.WriteByte(' ')
		}
	}
	return b.String()
}

func isPreserved(r rune) bool {
	switch r {
	case '.', ',', ';', '/', '&', '(', ')', '\'', '`', '\u2019':
		return true
	}
	return unicode.Is(unicode.Pd, r) // dash punctuation
}

func collapseWhitespace(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	prev := false
	for _, r := range s {
		if unicode.IsSpace(r) {
			if !prev {
				b.WriteByte(' ')
				prev = true
			}
		} else {
			b.WriteRune(r)
			prev = false
		}
	}
	return b.String()
}

func truncateBytes(s string, max int) string {
	if len(s) <= max {
		return s
	}
	for max > 0 && !utf8.RuneStart(s[max]) {
		max--
	}
	return s[:max]
}
