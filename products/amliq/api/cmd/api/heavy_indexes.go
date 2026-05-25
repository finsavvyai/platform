package main

import (
	"log"
	"os"
	"time"

	"github.com/aegis-aml/aegis/api"
	"github.com/aegis-aml/aegis/internal/ai"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// loadHeavyIndexes builds the full screening search index and the
// LLM cascade after the HTTP server is already listening, so Render's
// port-detect health check doesn't wait on hundreds of MB of entity
// data to hydrate from Postgres.
func loadHeavyIndexes(
	pool *pgx.Pool,
	entityRepo *pgx.EntityRepository,
	engine *screening.Engine,
	deps *api.Dependencies,
) {
	start := time.Now()

	// Search index (tiered or flat).
	for _, opt := range buildSearchTiers(pool.DB(), entityRepo) {
		opt(engine)
	}

	// Embedding matcher (layer 5) — pgvector cosine similarity.
	// Requires OPENAI_API_KEY for the embedder; gracefully skips if absent.
	if key := os.Getenv("OPENAI_API_KEY"); key != "" {
		embedRepo := pgx.NewEmbeddingRepository(pool.DB())
		embedder := screening.NewOpenAIEmbedder(key, os.Getenv("OPENAI_BASE_URL"), "")
		pgvec := screening.NewPgvectorMatcher(embedRepo, embedder, 0)
		screening.WithEmbeddingMatcher(pgvec)(engine)
		log.Println("Embedding matcher (pgvector) enabled")
	} else {
		log.Println("Embedding matcher disabled (OPENAI_API_KEY not set)")
	}

	// Graph matcher (layer 6) — relationship traversal.
	relRepo := pgx.NewRelationshipRepository(pool.DB())
	graph := screening.NewGraphMatcher(relRepo)
	screening.WithGraphMatcher(graph)(engine)
	log.Println("Graph matcher enabled")

	// LLM cascade — auto-selects best available provider.
	router := ai.NewModelRouter()
	providers := router.AvailableProviders()
	if len(providers) > 0 {
		cascade := screening.NewLLMCascade(router, 0.4, 0.8)
		screening.WithLLMCascade(cascade)(engine)
		log.Printf("LLM cascade enabled: %v", providers)
	} else {
		log.Println("LLM cascade disabled (no providers available)")
	}

	// Crypto wallet index — load into existing pointer so
	// CryptoSyncService (which captured the pointer at boot) stays
	// wired to the same index after hydration.
	screening.LoadCryptoInto(pool.DB(), deps.CryptoIdx)

	log.Printf("Heavy indexes loaded in %v", time.Since(start))
}
