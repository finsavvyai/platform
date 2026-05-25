package pgx

import "github.com/aegis-aml/aegis/internal/domain"

// dedupeByID removes duplicate entities by ID within a batch, keeping
// the LAST occurrence (treat later rows in the stream as fresher).
// Required because Postgres rejects ON CONFLICT DO UPDATE when the
// same id appears twice in one INSERT — "command cannot affect row
// a second time". israeli_treasury hit this in production on
// 2026-04-17. See docs/enrichment-gap-audit.md section A5.
func dedupeByID(batch []domain.Entity) []domain.Entity {
	if len(batch) < 2 {
		return batch
	}
	idx := make(map[string]int, len(batch))
	for i, ent := range batch {
		idx[ent.ID.String()] = i
	}
	if len(idx) == len(batch) {
		return batch
	}
	out := make([]domain.Entity, 0, len(idx))
	for i, ent := range batch {
		if idx[ent.ID.String()] == i {
			out = append(out, ent)
		}
	}
	return out
}
