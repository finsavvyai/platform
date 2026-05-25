package screening

import (
	"sync"

	"github.com/aegis-aml/aegis/internal/domain"
)

// PrecomputedIndex follows the moov-io/watchman pattern: pre-compute
// all phonetic codes, normalized names, and trigrams at index load
// time. This avoids recomputing features on every search query.
type PrecomputedIndex struct {
	mu sync.RWMutex

	// Pre-computed features per entity.
	entities     map[string]domain.Entity
	normalized   map[string]string          // entityID → normalized name
	soundexCodes map[string][]string        // entityID → soundex codes per word
	dmPrimary    map[string][]string        // entityID → DM primary codes
	dmAlternate  map[string][]string        // entityID → DM alternate codes
	trigramSets  map[string]map[string]bool // entityID → trigram set

	// Reverse indexes for O(1) lookup.
	exactMap   map[string][]string // normalized name → entityIDs
	soundexMap map[string][]string // soundex code → entityIDs
	dmMap      map[string][]string // DM code → entityIDs

	entCount int
}

// NewPrecomputedIndex creates an empty pre-computed index.
func NewPrecomputedIndex() *PrecomputedIndex {
	return &PrecomputedIndex{
		entities:     make(map[string]domain.Entity),
		normalized:   make(map[string]string),
		soundexCodes: make(map[string][]string),
		dmPrimary:    make(map[string][]string),
		dmAlternate:  make(map[string][]string),
		trigramSets:  make(map[string]map[string]bool),
		exactMap:     make(map[string][]string),
		soundexMap:   make(map[string][]string),
		dmMap:        make(map[string][]string),
	}
}

// EntityCount returns the number of indexed entities.
func (pi *PrecomputedIndex) EntityCount() int { return pi.entCount }

// sortCandidates is an insertion sort keyed on Score descending.
// Tiny candidate lists; saves a sort.Slice heap alloc.
func sortCandidates(c []Candidate) {
	for i := 1; i < len(c); i++ {
		for j := i; j > 0 && c[j].Score > c[j-1].Score; j-- {
			c[j], c[j-1] = c[j-1], c[j]
		}
	}
}
