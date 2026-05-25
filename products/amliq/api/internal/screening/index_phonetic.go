package screening

import (
	"strings"
	"sync"

	"github.com/aegis-aml/aegis/internal/domain"
)

// phoneticCodesCache memoizes phoneticCodes() results across
// matcher calls + index builds. The per-call cost (Soundex +
// Metaphone + Double Metaphone for each word) is ~3x fuzzy's
// per-call cost and runs once per candidate per screen otherwise.
var phoneticCodesCache sync.Map // map[string][]string

// phoneticIndex maps phonetic codes to entity IDs.
type phoneticIndex struct {
	codeMap map[string][]domain.EntityID
}

// buildPhonetic constructs the phonetic hash map using Soundex + Metaphone.
func buildPhonetic(entities []domain.Entity) phoneticIndex {
	idx := phoneticIndex{codeMap: make(map[string][]domain.EntityID)}
	for _, e := range entities {
		for _, n := range e.Names {
			codes := phoneticCodes(n.Full)
			for _, code := range codes {
				idx.codeMap[code] = append(idx.codeMap[code], e.ID)
			}
		}
	}
	return idx
}

// lookup returns entity IDs matching any phonetic code of the query.
func (pi phoneticIndex) lookup(query string) []domain.EntityID {
	codes := phoneticCodes(query)
	seen := make(map[string]bool)
	var results []domain.EntityID
	for _, code := range codes {
		for _, id := range pi.codeMap[code] {
			if !seen[id.String()] {
				seen[id.String()] = true
				results = append(results, id)
			}
		}
	}
	return results
}

// phoneticCodes returns Soundex, Metaphone, and Double Metaphone codes
// for each word in the name. Double Metaphone improves matching for
// Arabic, Slavic, Germanic, and other non-English name transliterations.
// Result is pure-function of input so we memoize via phoneticCodesCache.
func phoneticCodes(name string) []string {
	if v, ok := phoneticCodesCache.Load(name); ok {
		return v.([]string)
	}
	out := computePhoneticCodes(name)
	phoneticCodesCache.Store(name, out)
	return out
}

// computePhoneticCodes does the real work. Kept separate so the
// memoized wrapper stays small.
func computePhoneticCodes(name string) []string {
	name = normalizeExact(name)
	words := strings.Fields(name)
	codes := make([]string, 0, len(words)*4)
	for _, w := range words {
		if len(w) < 2 {
			continue
		}
		if sc := soundexCode(w); sc != "" {
			codes = append(codes, "sx:"+sc)
		}
		if mc := metaphoneCode(w); mc != "" {
			codes = append(codes, "mp:"+mc)
		}
		pri, alt := DoubleMetaphone(w)
		if pri != "" {
			codes = append(codes, "dm:"+pri)
		}
		if alt != "" && alt != pri {
			codes = append(codes, "dm:"+alt)
		}
	}
	return codes
}

