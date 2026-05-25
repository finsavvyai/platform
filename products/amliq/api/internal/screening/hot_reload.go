package screening

import (
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
)

// HotReload updates the search index in-place without restart.
// Thread-safe: acquires write lock so reads block only briefly.
func HotReload(
	index *SearchIndex,
	newEntities []domain.Entity,
	removedIDs []string,
) {
	index.mu.Lock()
	defer index.mu.Unlock()

	// Remove deleted entities
	for _, id := range removedIDs {
		delete(index.entities, id)
	}

	// Add new/modified entities
	for _, e := range newEntities {
		index.entities[e.ID.String()] = e
	}

	// Rebuild all sub-indexes from current entity map
	entities := entityMapToSlice(index.entities)
	index.exact = buildExact(entities)
	index.phonetic = buildPhonetic(entities)
	index.tokens = buildTokens(entities)
	index.trigrams = buildTrigrams(entities)
	index.entCount = len(entities)

	log.Printf(
		"Hot reload: +%d added, -%d removed, %d total entities",
		len(newEntities), len(removedIDs), index.entCount,
	)
}

// EntityCount returns the number of entities in the index (thread-safe).
func EntityCount(index *SearchIndex) int {
	index.mu.RLock()
	defer index.mu.RUnlock()
	return index.entCount
}

// entityMapToSlice converts the entity map to a slice for rebuilding.
func entityMapToSlice(m map[string]domain.Entity) []domain.Entity {
	entities := make([]domain.Entity, 0, len(m))
	for _, e := range m {
		entities = append(entities, e)
	}
	return entities
}
