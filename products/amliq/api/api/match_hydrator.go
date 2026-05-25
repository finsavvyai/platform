package api

import (
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// hydrateMatchEntities loads the full Entity for each match so the
// response enricher can promote metadata, identifiers, addresses, etc.
// Returns a slice in the same order as matches; missing entities are
// skipped (buildDemoResponse keys the map by EntityID).
func hydrateMatchEntities(
	matches []domain.MatchResult,
	repo storage.EntityRepository,
) []domain.Entity {
	if repo == nil || len(matches) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(matches))
	out := make([]domain.Entity, 0, len(matches))
	for _, m := range matches {
		key := m.EntityID.String()
		if seen[key] {
			continue
		}
		seen[key] = true
		ent, err := repo.GetByID(m.EntityID)
		if err != nil || ent == nil {
			continue
		}
		out = append(out, *ent)
	}
	return out
}
