package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichNestedMeta copies top-level FtM fields (datasets, referents,
// timestamps, schema) onto the entity. Property-level fields are
// handled by enrichBulkFromProps.
func enrichNestedMeta(ent *domain.Entity, row nestedRow) {
	if v := strings.TrimSpace(row.Schema); v != "" {
		setMeta(ent, "schemaType", v)
	}
	if v := strings.TrimSpace(row.FirstSeen); v != "" {
		setMeta(ent, "first_seen", v)
		setMeta(ent, "firstSeen", v)
	}
	if v := strings.TrimSpace(row.LastSeen); v != "" {
		setMeta(ent, "last_seen", v)
		setMeta(ent, "lastSeen", v)
	}
	if v := strings.TrimSpace(row.LastChange); v != "" {
		setMeta(ent, "last_change", v)
		setMeta(ent, "lastChange", v)
	}
	if len(row.Datasets) > 0 {
		setMeta(ent, "dataset", strings.Join(row.Datasets, ", "))
		ent.Metadata["datasets"] = toIfaceSlice(row.Datasets)
	}
	if len(row.Referents) > 0 {
		ent.Metadata["referents"] = toIfaceSlice(row.Referents)
	}
}
