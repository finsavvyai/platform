package pgx

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// QuickSearch uses ILIKE for fast indexed search. Falls back to
// trigram only if ILIKE finds nothing. Much faster than FastSearch
// on large tables (1M+) during concurrent writes.
func (r *EntityRepository) QuickSearch(
	ctx context.Context, name string, limit int,
) ([]domain.Entity, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	last := lastWord(name)

	// Tier 1: ILIKE on last word (uses GIN trigram index).
	// If the name is one word, tier 2 (full-name ILIKE) is identical,
	// so skip it later.
	singleWord := last == name
	results, err := r.ilikeSearch(ctx, last, limit)
	if err != nil {
		return nil, fmt.Errorf("quick search: %w", err)
	}
	if len(results) > 0 {
		return results, nil
	}

	// Tier 2: full name ILIKE — skip when identical to tier 1 to
	// avoid a redundant DB round-trip before tier 3 runs.
	if singleWord {
		return r.trigramSearch(ctx, name, limit)
	}
	results, err = r.ilikeSearch(ctx, name, limit)
	if err != nil {
		return nil, fmt.Errorf("quick search full: %w", err)
	}
	if len(results) > 0 {
		return results, nil
	}
	return r.trigramSearch(ctx, name, limit)
}
