package pgx

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/aegis-aml/aegis/internal/domain"
)

// RelationshipRepository persists entity relationships.
type RelationshipRepository struct {
	db *sql.DB
}

func NewRelationshipRepository(db *sql.DB) *RelationshipRepository {
	return &RelationshipRepository{db: db}
}

func (r *RelationshipRepository) Store(
	ctx context.Context, rel domain.Relationship,
) error {
	meta, _ := json.Marshal(rel.Metadata)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO entity_relationships
		(source_entity_id, target_entity_id, relationship_type,
		 confidence, source_list, metadata)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (source_entity_id, target_entity_id, relationship_type)
		DO UPDATE SET confidence=$4, metadata=$6`,
		rel.SourceEntityID, rel.TargetEntityID,
		rel.RelationshipType, rel.Confidence,
		rel.SourceList, meta)
	return err
}

func (r *RelationshipRepository) FindByEntity(
	ctx context.Context, entityID string,
) ([]domain.Relationship, error) {
	return r.FindByEntityWithDepth(ctx, entityID, 1)
}
