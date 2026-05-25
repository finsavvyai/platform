package screening

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// PgvectorMatcher uses pgvector for embedding-based name matching.
type PgvectorMatcher struct {
	embedRepo *pgx.EmbeddingRepository
	embedder  Embedder
	threshold float64
}

// Embedder generates vector embeddings for text.
type Embedder interface {
	Embed(ctx context.Context, text string) ([]float64, error)
}

func NewPgvectorMatcher(
	repo *pgx.EmbeddingRepository, embedder Embedder, threshold float64,
) *PgvectorMatcher {
	if threshold == 0 {
		threshold = 0.75
	}
	return &PgvectorMatcher{
		embedRepo: repo, embedder: embedder, threshold: threshold,
	}
}

// MatchWithContext performs vector similarity search via pgvector.
func (pm *PgvectorMatcher) MatchWithContext(
	ctx context.Context, tenantID domain.TenantID, query domain.Name,
) ([]domain.MatchEvidence, error) {
	vec, err := pm.embedder.Embed(ctx, query.Full)
	if err != nil {
		return nil, err
	}
	similar, err := pm.embedRepo.FindSimilar(
		ctx, tenantID, vec, pm.threshold, 50)
	if err != nil {
		return nil, err
	}
	var evidence []domain.MatchEvidence
	for _, se := range similar {
		ev := domain.NewMatchEvidence(
			domain.MatchLayerEmbedding,
			"pgvector_cosine",
			se.Similarity,
			pm.threshold,
			query.Full,
			se.FullName,
			"pgvector cosine similarity search",
		)
		evidence = append(evidence, ev)
	}
	return evidence, nil
}
