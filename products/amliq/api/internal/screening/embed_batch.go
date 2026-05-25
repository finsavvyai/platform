package screening

import (
	"context"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// EmbeddingGenerator bulk-generates and stores entity embeddings.
type EmbeddingGenerator struct {
	embedder  Embedder
	embedRepo *pgx.EmbeddingRepository
}

func NewEmbeddingGenerator(
	embedder Embedder, repo *pgx.EmbeddingRepository,
) *EmbeddingGenerator {
	return &EmbeddingGenerator{embedder: embedder, embedRepo: repo}
}

// GenerateForEntities creates embeddings for a batch of entities.
func (eg *EmbeddingGenerator) GenerateForEntities(
	ctx context.Context, entities []domain.Entity,
) (int, error) {
	stored := 0
	for _, ent := range entities {
		name := ent.PrimaryName().Full
		if name == "" {
			continue
		}
		vec, err := eg.embedder.Embed(ctx, name)
		if err != nil {
			log.Printf("embed %s failed: %v", ent.ID, err)
			continue
		}
		if err := eg.embedRepo.StoreEmbedding(ctx, ent.ID, vec); err != nil {
			log.Printf("store embedding %s: %v", ent.ID, err)
			continue
		}
		stored++
	}
	return stored, nil
}
