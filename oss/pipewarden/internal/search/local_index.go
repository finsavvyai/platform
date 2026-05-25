// Local hybrid (BM25 + char-trigram cosine) search over findings. Pure
// Go, no external service. Used when no RuVector sidecar is configured —
// the air-gap default. The index lives in memory; rebuild from storage
// at boot via Rebuild.
package search

import (
	"strings"
	"sync"
)

// Document is the minimum a finding must expose to be indexable. Anything
// implementing this interface (FindingRecord etc.) can be added.
type Document interface {
	DocID() int64
	DocText() string
	DocLabel() string
}

// LocalHit is a ranked search result. Score is unitless and only
// meaningful for ordering within a single query.
type LocalHit struct {
	ID    int64   `json:"id"`
	Label string  `json:"label,omitempty"`
	Score float64 `json:"score"`
}

// LocalIndex is a thread-safe in-memory hybrid index. Zero value is not
// usable — call NewLocalIndex.
type LocalIndex struct {
	mu sync.RWMutex

	docs     map[int64]docEntry
	df       map[string]int // term -> doc frequency
	totalLen int            // sum of token counts across all docs
	avgLen   float64
}

type docEntry struct {
	id       int64
	label    string
	tokens   map[string]int      // term -> term frequency
	trigrams map[string]struct{} // unique char trigrams
	length   int
}

// NewLocalIndex returns an empty index.
func NewLocalIndex() *LocalIndex {
	return &LocalIndex{
		docs: make(map[int64]docEntry),
		df:   make(map[string]int),
	}
}

// Add inserts or replaces a document. Empty text is ignored.
func (i *LocalIndex) Add(d Document) {
	if d == nil {
		return
	}
	text := strings.TrimSpace(d.DocText())
	if text == "" {
		return
	}
	tokens := tokenize(text)
	if len(tokens) == 0 {
		return
	}
	tf := make(map[string]int, len(tokens))
	for _, t := range tokens {
		tf[t]++
	}
	tris := trigrams(text)

	i.mu.Lock()
	defer i.mu.Unlock()

	// Subtract old contribution if replacing.
	if old, ok := i.docs[d.DocID()]; ok {
		for term := range old.tokens {
			i.df[term]--
			if i.df[term] <= 0 {
				delete(i.df, term)
			}
		}
		i.totalLen -= old.length
	}

	for term := range tf {
		i.df[term]++
	}
	i.docs[d.DocID()] = docEntry{
		id:       d.DocID(),
		label:    d.DocLabel(),
		tokens:   tf,
		trigrams: tris,
		length:   len(tokens),
	}
	i.totalLen += len(tokens)
	if n := len(i.docs); n > 0 {
		i.avgLen = float64(i.totalLen) / float64(n)
	}
}

// Remove drops a document by ID.
func (i *LocalIndex) Remove(id int64) {
	i.mu.Lock()
	defer i.mu.Unlock()
	old, ok := i.docs[id]
	if !ok {
		return
	}
	for term := range old.tokens {
		i.df[term]--
		if i.df[term] <= 0 {
			delete(i.df, term)
		}
	}
	i.totalLen -= old.length
	delete(i.docs, id)
	if n := len(i.docs); n > 0 {
		i.avgLen = float64(i.totalLen) / float64(n)
	} else {
		i.avgLen = 0
	}
}

// Size returns the number of indexed documents.
func (i *LocalIndex) Size() int {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return len(i.docs)
}
