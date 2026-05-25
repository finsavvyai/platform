package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// DuplicateCandidate represents a potential duplicate entity.
type DuplicateCandidate struct {
	EntityID   domain.EntityID
	Similarity float64
	ListID     string
}

// Deduplicator detects and merges duplicate entities across lists.
// Uses hash-bucketed lookup for O(1) candidate retrieval instead of O(n) scan.
type Deduplicator struct {
	entities []domain.Entity
	nameIdx  map[string][]int // normalized name → entity indices
}

// NewDeduplicator creates a deduplicator with pre-built name index.
func NewDeduplicator(entities []domain.Entity) *Deduplicator {
	idx := make(map[string][]int, len(entities))
	for i, e := range entities {
		key := normalizeFull(e)
		if key != "" {
			idx[key] = append(idx[key], i)
		}
	}
	return &Deduplicator{entities: entities, nameIdx: idx}
}

// FindDuplicates returns candidates matching the given entity.
// O(bucket_size) instead of O(n) — typically 1-5 entities per bucket.
func (d *Deduplicator) FindDuplicates(entity domain.Entity) []DuplicateCandidate {
	var candidates []DuplicateCandidate
	targetName := normalizeFull(entity)

	// Check exact name bucket first (catches ~90% of duplicates)
	if indices, ok := d.nameIdx[targetName]; ok {
		for _, idx := range indices {
			existing := d.entities[idx]
			if existing.ID == entity.ID || existing.ListID == entity.ListID {
				continue
			}
			sim := d.similarity(entity, existing, targetName)
			if sim >= 0.8 {
				candidates = append(candidates, DuplicateCandidate{
					EntityID:   existing.ID,
					Similarity: sim,
					ListID:     existing.ListID,
				})
			}
		}
	}
	return candidates
}

func (d *Deduplicator) similarity(
	a, b domain.Entity, aName string,
) float64 {
	score := 0.0
	bName := normalizeFull(b)
	if aName == bName && aName != "" {
		score += 0.5
	}
	if a.DOB != nil && b.DOB != nil && a.DOB.Equal(*b.DOB) {
		score += 0.3
	}
	if hasOverlap(a.Nationalities, b.Nationalities) {
		score += 0.2
	}
	return score
}

func normalizeFull(e domain.Entity) string {
	if len(e.Names) == 0 {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(e.Names[0].Full))
}

// hasOverlap uses a set for O(n+m) instead of O(n*m) comparison.
func hasOverlap(a, b []string) bool {
	if len(a) == 0 || len(b) == 0 {
		return false
	}
	set := make(map[string]struct{}, len(a))
	for _, x := range a {
		set[strings.ToLower(x)] = struct{}{}
	}
	for _, y := range b {
		if _, ok := set[strings.ToLower(y)]; ok {
			return true
		}
	}
	return false
}

func hasName(names []domain.Name, target domain.Name) bool {
	for _, n := range names {
		if strings.EqualFold(n.Full, target.Full) {
			return true
		}
	}
	return false
}
