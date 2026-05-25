package screening

import (
	"fmt"
	"log"
	"time"
	"unsafe"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// IndexStats holds metrics about the search index.
type IndexStats struct {
	EntityCount  int
	ExactKeys    int
	PhoneticKeys int
	TokenKeys    int
	TrigramKeys  int
	MemoryBytes  int64
	BuildTimeMs  int64
}

// HighPriorityLists are loaded into RAM for O(1) lookup.
// These are the core sanctions lists that must be sub-1ms.
var HighPriorityLists = []string{
	"ofac-sdn", "us_ofac_sdn", "us_ofac_cons",
	"un_sc_sanctions", "eu_fsf", "uk_ofsi",
	"ch_seco", "il_nbctf",
}

// TieredLoader wraps index + DB fallback.
type TieredLoader struct {
	repo storage.EntityRepository
}

// LoadFromRepo builds a SearchIndex from high-priority lists only.
// Other entities stay in PostgreSQL (searched via trigram).
func LoadFromRepo(repo storage.EntityRepository) (*SearchIndex, error) {
	start := time.Now()

	// Try tiered load first (high-priority lists only)
	entities, err := loadHighPriority(repo)
	if err != nil || len(entities) == 0 {
		// Fallback: load all (for small DBs < 200K)
		entities, err = repo.ListAll()
		if err != nil {
			return nil, fmt.Errorf("index load: %w", err)
		}
	}

	idx := NewSearchIndex()
	idx.Load(entities)

	elapsed := time.Since(start).Milliseconds()
	stats := idx.Stats()
	log.Printf(
		"Loaded %d entities into search index (%d KB, %d ms)",
		stats.EntityCount, stats.MemoryBytes/1024, elapsed,
	)
	return idx, nil
}

// loadHighPriority loads only core sanctions lists into RAM.
func loadHighPriority(repo storage.EntityRepository) ([]domain.Entity, error) {
	type listLoader interface {
		ListByLists(listIDs []string) ([]domain.Entity, error)
	}
	lr, ok := repo.(listLoader)
	if !ok {
		return nil, fmt.Errorf("repo does not support ListByLists")
	}
	return lr.ListByLists(HighPriorityLists)
}

// Refresh rebuilds the index from high-priority lists.
func Refresh(idx *SearchIndex, repo storage.EntityRepository) error {
	entities, err := loadHighPriority(repo)
	if err != nil || len(entities) == 0 {
		entities, err = repo.ListAll()
		if err != nil {
			return fmt.Errorf("index refresh: %w", err)
		}
	}
	idx.Load(entities)
	log.Printf("Index refreshed: %d entities", len(entities))
	return nil
}

// Stats returns metrics about the current index state.
func (si *SearchIndex) Stats() IndexStats {
	si.mu.RLock()
	defer si.mu.RUnlock()

	mem := int64(unsafe.Sizeof(*si))
	mem += estimateMapSize(len(si.exact.nameMap))
	mem += estimateMapSize(len(si.phonetic.codeMap))
	mem += estimateMapSize(len(si.tokens.index))
	mem += estimateMapSize(len(si.trigrams.gramMap))

	return IndexStats{
		EntityCount:  si.entCount,
		ExactKeys:    len(si.exact.nameMap),
		PhoneticKeys: len(si.phonetic.codeMap),
		TokenKeys:    len(si.tokens.index),
		TrigramKeys:  len(si.trigrams.gramMap),
		MemoryBytes:  mem,
	}
}

// EntityCount returns the number of indexed entities.
func (si *SearchIndex) EntityCount() int {
	si.mu.RLock()
	defer si.mu.RUnlock()
	return si.entCount
}

// estimateMapSize gives a rough byte estimate for a map with n keys.
func estimateMapSize(n int) int64 {
	return int64(n) * 100
}
