package pgx

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// upsertOne is kept for single-entity operations.
func (r *EntityRepository) upsertOne(
	ctx context.Context,
	tenantID domain.TenantID,
	entity domain.Entity,
) error {
	name := entity.PrimaryName().Full
	normalized := strings.ToLower(nonAlpha.ReplaceAllString(name, ""))
	nats := strings.Join(entity.Nationalities, ",")
	meta, _ := json.Marshal(entity.Metadata)
	if len(entity.Metadata) == 0 {
		meta = nil
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO entities (
			id, tenant_id, type, full_name, given_name, family_name,
			original_script, list_id, name_normalized,
			dob, nationalities, metadata,
			created_at, updated_at,
			pep_tier, designation_date, delisting_date,
			position_title, place_of_birth, gender
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
		ON CONFLICT (id) DO UPDATE SET
			tenant_id = EXCLUDED.tenant_id,
			full_name = EXCLUDED.full_name,
			given_name = EXCLUDED.given_name,
			family_name = EXCLUDED.family_name,
			list_id = EXCLUDED.list_id,
			name_normalized = EXCLUDED.name_normalized,
			dob = EXCLUDED.dob,
			nationalities = EXCLUDED.nationalities,
			metadata = EXCLUDED.metadata,
			updated_at = EXCLUDED.updated_at,
			pep_tier = EXCLUDED.pep_tier,
			designation_date = EXCLUDED.designation_date,
			delisting_date = EXCLUDED.delisting_date,
			position_title = EXCLUDED.position_title,
			place_of_birth = EXCLUDED.place_of_birth,
			gender = EXCLUDED.gender
	`,
		entity.ID.String(), tenantID.String(),
		entity.Type.String(), name,
		entity.PrimaryName().Given, entity.PrimaryName().Family,
		entity.PrimaryName().OriginalScript, entity.ListID,
		normalized,
		entity.DOB, nats, meta,
		entity.CreatedAt, entity.UpdatedAt,
		nullableInt16(int16(entity.PEPTier)),
		entity.DesignationDate, entity.DelistingDate,
		nullableString(entity.PositionTitle),
		nullableString(entity.PlaceOfBirth),
		nullableString(entity.Gender),
	)
	return err
}

// nullableInt16 returns nil for zero value so the column stays NULL
// rather than storing 0 for entities that have no tier signal.
func nullableInt16(v int16) interface{} {
	if v == 0 {
		return nil
	}
	return v
}

// nullableString returns nil for empty so text columns stay NULL
// instead of storing "" and polluting WHERE IS NOT NULL filters.
func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
