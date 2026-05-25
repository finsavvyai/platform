package pgx

import "github.com/aegis-aml/aegis/internal/domain"

// MarshalRichCols is the exported wrapper around marshalRichCols,
// allowing external tooling (e.g. cmd/backfill-rich) to reuse the
// same JSONB encoding the repo uses on its write path.
func MarshalRichCols(ent domain.Entity) (addrs, ids, aliases []byte) {
	return marshalRichCols(ent)
}
