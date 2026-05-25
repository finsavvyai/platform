package pgx

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EmbeddingRepository stores and queries pgvector embeddings.
type EmbeddingRepository struct {
	db *sql.DB
}

func NewEmbeddingRepository(db *sql.DB) *EmbeddingRepository {
	return &EmbeddingRepository{db: db}
}

// StoreEmbedding updates the embedding column for an entity.
func (r *EmbeddingRepository) StoreEmbedding(
	ctx context.Context, entityID domain.EntityID, vector []float64,
) error {
	vecStr := vectorToString(vector)
	_, err := r.db.ExecContext(ctx,
		`UPDATE entities SET embedding = $1::vector WHERE id = $2`,
		vecStr, entityID.String())
	return err
}

// FindSimilar returns entities within cosine distance of a query vector.
func (r *EmbeddingRepository) FindSimilar(
	ctx context.Context, tenantID domain.TenantID,
	vector []float64, threshold float64, limit int,
) ([]SimilarEntity, error) {
	vecStr := vectorToString(vector)
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, full_name, 1 - (embedding <=> $1::vector) AS similarity
		FROM entities
		WHERE tenant_id = $2 AND embedding IS NOT NULL
		  AND 1 - (embedding <=> $1::vector) > $3
		ORDER BY embedding <=> $1::vector
		LIMIT $4`,
		vecStr, tenantID.String(), threshold, limit)
	if err != nil {
		return nil, fmt.Errorf("vector search: %w", err)
	}
	defer rows.Close()
	return scanSimilarEntities(rows)
}

// SimilarEntity holds a vector search result.
type SimilarEntity struct {
	EntityID   string
	FullName   string
	Similarity float64
}

func scanSimilarEntities(rows *sql.Rows) ([]SimilarEntity, error) {
	var results []SimilarEntity
	for rows.Next() {
		var se SimilarEntity
		if err := rows.Scan(&se.EntityID, &se.FullName, &se.Similarity); err != nil {
			return nil, err
		}
		results = append(results, se)
	}
	return results, rows.Err()
}

func vectorToString(v []float64) string {
	parts := make([]string, len(v))
	for i, f := range v {
		parts[i] = fmt.Sprintf("%.8f", f)
	}
	return "[" + strings.Join(parts, ",") + "]"
}
