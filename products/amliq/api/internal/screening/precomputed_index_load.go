package screening

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Load pre-computes all features for the given entities.
// Called once at startup; holds the write lock for the duration.
func (pi *PrecomputedIndex) Load(entities []domain.Entity) {
	pi.mu.Lock()
	defer pi.mu.Unlock()

	for _, e := range entities {
		id := e.ID.String()
		pi.entities[id] = e
		for _, n := range e.Names {
			pi.indexEntityName(id, n.Full)
		}
	}
	pi.entCount = len(entities)
}

func (pi *PrecomputedIndex) indexEntityName(id, full string) {
	norm := normalizeExact(full)
	pi.normalized[id] = norm
	pi.exactMap[norm] = append(pi.exactMap[norm], id)

	words := strings.Fields(norm)
	pi.indexSoundex(id, words)
	pi.indexDoubleMetaphone(id, words)
	pi.indexTrigrams(id, norm)
}

func (pi *PrecomputedIndex) indexSoundex(id string, words []string) {
	for _, w := range words {
		if len(w) < 2 {
			continue
		}
		sc := soundexCode(strings.ToUpper(w))
		if sc == "" {
			continue
		}
		pi.soundexCodes[id] = append(pi.soundexCodes[id], sc)
		pi.soundexMap[sc] = append(pi.soundexMap[sc], id)
	}
}

func (pi *PrecomputedIndex) indexDoubleMetaphone(id string, words []string) {
	for _, w := range words {
		if len(w) < 2 {
			continue
		}
		pri, alt := DoubleMetaphone(w)
		if pri != "" {
			pi.dmPrimary[id] = append(pi.dmPrimary[id], pri)
			pi.dmMap[pri] = append(pi.dmMap[pri], id)
		}
		if alt != "" && alt != pri {
			pi.dmAlternate[id] = append(pi.dmAlternate[id], alt)
			pi.dmMap[alt] = append(pi.dmMap[alt], id)
		}
	}
}

func (pi *PrecomputedIndex) indexTrigrams(id, norm string) {
	tris := computeTrigrams(norm)
	triSet := make(map[string]bool, len(tris))
	for _, t := range tris {
		triSet[t] = true
	}
	pi.trigramSets[id] = triSet
}
