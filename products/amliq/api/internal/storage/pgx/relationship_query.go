package pgx

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

// FindByEntityWithDepth traverses relationships up to maxDepth hops.
func (r *RelationshipRepository) FindByEntityWithDepth(
	ctx context.Context, entityID string, maxDepth int,
) ([]domain.Relationship, error) {
	rows, err := r.db.QueryContext(ctx, `
		WITH RECURSIVE rel_chain AS (
			SELECT id, source_entity_id, target_entity_id,
			       relationship_type, confidence, source_list, 1 as depth
			FROM entity_relationships
			WHERE source_entity_id = $1
			UNION ALL
			SELECT er.id, er.source_entity_id, er.target_entity_id,
			       er.relationship_type, er.confidence, er.source_list,
			       rc.depth + 1
			FROM entity_relationships er
			JOIN rel_chain rc ON er.source_entity_id = rc.target_entity_id
			WHERE rc.depth < $2
		)
		SELECT id, source_entity_id, target_entity_id,
		       relationship_type, confidence, source_list
		FROM rel_chain`, entityID, maxDepth)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRelationships(rows)
}

// BulkStore inserts multiple relationships in a single transaction.
func (r *RelationshipRepository) BulkStore(
	ctx context.Context, rels []domain.Relationship,
) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO entity_relationships
		(source_entity_id, target_entity_id, relationship_type,
		 confidence, source_list)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (source_entity_id, target_entity_id, relationship_type)
		DO UPDATE SET confidence=$4`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, rel := range rels {
		_, err = stmt.ExecContext(ctx,
			rel.SourceEntityID, rel.TargetEntityID,
			rel.RelationshipType, rel.Confidence, rel.SourceList)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func scanRelationships(rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
},
) ([]domain.Relationship, error) {
	var rels []domain.Relationship
	for rows.Next() {
		var rel domain.Relationship
		var relType string
		if err := rows.Scan(
			&rel.ID, &rel.SourceEntityID, &rel.TargetEntityID,
			&relType, &rel.Confidence, &rel.SourceList,
		); err != nil {
			return nil, err
		}
		rel.RelationshipType = domain.RelationshipType(relType)
		rels = append(rels, rel)
	}
	return rels, rows.Err()
}
