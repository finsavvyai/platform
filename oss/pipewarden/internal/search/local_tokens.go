package search

import (
	"strings"
	"unicode"
)

// tokenize lowercases and splits text on non-letter/digit boundaries,
// dropping single-character tokens and English stopwords. Pure Go, no
// allocation surprises beyond the returned slice.
func tokenize(text string) []string {
	if text == "" {
		return nil
	}
	text = strings.ToLower(text)
	out := make([]string, 0, 32)
	var b strings.Builder
	flush := func() {
		if b.Len() < 2 {
			b.Reset()
			return
		}
		w := b.String()
		if !isStopword(w) {
			out = append(out, w)
		}
		b.Reset()
	}
	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			flush()
		}
	}
	flush()
	return out
}

// trigrams returns the unique character trigram set of text after
// lowercasing. Spaces and punctuation are kept so cross-word trigrams
// reduce false positives. A token shorter than 3 chars is padded.
func trigrams(text string) map[string]struct{} {
	if text == "" {
		return nil
	}
	text = strings.ToLower(strings.TrimSpace(text))
	if len(text) < 3 {
		text = " " + text + " "
	}
	out := make(map[string]struct{}, len(text))
	r := []rune(text)
	for i := 0; i+3 <= len(r); i++ {
		out[string(r[i:i+3])] = struct{}{}
	}
	return out
}

// isStopword filters very common English words that add noise to BM25.
// Kept tiny on purpose — security findings have a small core vocabulary.
var stopwords = map[string]struct{}{
	"a": {}, "an": {}, "the": {}, "and": {}, "or": {}, "but": {},
	"of": {}, "in": {}, "on": {}, "at": {}, "to": {}, "from": {},
	"by": {}, "for": {}, "is": {}, "are": {}, "was": {}, "were": {},
	"be": {}, "been": {}, "this": {}, "that": {}, "with": {}, "as": {},
	"it": {}, "its": {}, "if": {}, "not": {}, "no": {}, "yes": {},
}

func isStopword(w string) bool {
	_, ok := stopwords[w]
	return ok
}
