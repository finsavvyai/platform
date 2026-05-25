package pgx

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// placeholders returns a "($1,$2,...,$N)" parameter tuple starting at
// offset `base+1`. Used by BulkUpsert to batch-insert many rows in a
// single round trip.
func placeholders(base, count int) string {
	var sb strings.Builder
	sb.WriteByte('(')
	for i := 0; i < count; i++ {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(fmt.Sprintf("$%d", base+i+1))
	}
	sb.WriteByte(')')
	return sb.String()
}

// entityArgs assembles the 23 column values (in the exact order of
// the INSERT column list in upsertBatch) for one entity row. The
// rich columns (addresses / identifiers / aliases) + the enrichment
// columns from migration 067 come last so the diff is additive.
func entityArgs(ent domain.Entity, tid domain.TenantID) []interface{} {
	name := ent.PrimaryName().Full
	normalized := strings.ToLower(nonAlpha.ReplaceAllString(name, ""))
	nats := strings.Join(ent.Nationalities, ",")
	meta, _ := json.Marshal(ent.Metadata)
	if len(ent.Metadata) == 0 {
		meta = nil
	}
	addrs, ids, aliases := marshalRichCols(ent)
	return []interface{}{
		ent.ID.String(), tid.String(), ent.Type.String(), name,
		ent.PrimaryName().Given, ent.PrimaryName().Family,
		ent.PrimaryName().OriginalScript, ent.ListID, normalized,
		ent.DOB, nats, meta,
		ent.CreatedAt, ent.UpdatedAt,
		addrs, ids, aliases,
		nullableInt16(int16(ent.PEPTier)),
		ent.DesignationDate, ent.DelistingDate,
		nullableString(ent.PositionTitle),
		nullableString(ent.PlaceOfBirth),
		nullableString(ent.Gender),
	}
}
