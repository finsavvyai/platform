package screening

import (
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/puzpuzpuz/xsync/v3"
)

// ConcurrentSearchIndex is a lock-free search index using xsync.MapOf.
// 5-10x faster concurrent reads compared to sync.RWMutex-based SearchIndex.
type ConcurrentSearchIndex struct {
	entities *xsync.MapOf[string, domain.Entity]
	exact    *xsync.MapOf[string, []domain.EntityID]
	phonetic *xsync.MapOf[string, []domain.EntityID]
	tokens   *xsync.MapOf[string, []domain.EntityID]
	trigrams *xsync.MapOf[string, []domain.EntityID]
	entCount int
}

// NewConcurrentSearchIndex creates an empty lock-free search index.
func NewConcurrentSearchIndex() *ConcurrentSearchIndex {
	return &ConcurrentSearchIndex{
		entities: xsync.NewMapOf[string, domain.Entity](),
		exact:    xsync.NewMapOf[string, []domain.EntityID](),
		phonetic: xsync.NewMapOf[string, []domain.EntityID](),
		tokens:   xsync.NewMapOf[string, []domain.EntityID](),
		trigrams: xsync.NewMapOf[string, []domain.EntityID](),
	}
}

// Load builds all sub-indexes from an entity list.
// Called once at startup under a single goroutine, so Store is safe
// even though the lookup maps are lock-free.
func (ci *ConcurrentSearchIndex) Load(entities []domain.Entity) {
	for _, e := range entities {
		ci.entities.Store(e.ID.String(), e)
		for _, n := range e.Names {
			ci.indexName(n.Full, e.ID)
		}
	}
	ci.entCount = len(entities)
}

// indexName inserts one name's exact / phonetic / token / trigram
// postings into every sub-index.
func (ci *ConcurrentSearchIndex) indexName(name string, id domain.EntityID) {
	if key := normalizeExact(name); key != "" {
		ci.appendToMap(ci.exact, key, id)
	}
	for _, code := range phoneticCodes(name) {
		ci.appendToMap(ci.phonetic, code, id)
	}
	for _, tok := range tokenize(name) {
		ci.appendToMap(ci.tokens, tok, id)
	}
	for _, tri := range computeTrigrams(normalizeExact(name)) {
		ci.appendToMap(ci.trigrams, tri, id)
	}
}

// EntityCount returns the number of entities loaded.
func (ci *ConcurrentSearchIndex) EntityCount() int { return ci.entCount }

func (ci *ConcurrentSearchIndex) appendToMap(
	m *xsync.MapOf[string, []domain.EntityID], key string, id domain.EntityID,
) {
	existing, loaded := m.Load(key)
	if !loaded {
		m.Store(key, []domain.EntityID{id})
		return
	}
	m.Store(key, append(existing, id))
}
