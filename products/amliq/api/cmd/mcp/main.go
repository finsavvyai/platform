package main

import (
	"log"
	"os"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/mcp"
	"github.com/aegis-aml/aegis/internal/screening"
)

func main() {
	log.SetPrefix("amliq-mcp: ")
	idx := screening.NewSearchIndex()
	entities := loadSeedEntities()
	if len(entities) > 0 {
		idx.Load(entities)
		log.Printf("loaded %d entities into search index", len(entities))
	}
	scorer := screening.NewWeightedScorer(defaultWeights())
	engine := screening.NewEngine(scorer, screening.WithSearchIndex(idx))
	server := mcp.NewServer(engine, idx)
	log.Println("MCP server starting on stdio")
	if err := server.RunStdio(os.Stdin, os.Stdout); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func defaultWeights() map[string]float64 {
	return map[string]float64{
		"Exact": 1.0, "Fuzzy": 0.85, "Phonetic": 0.7,
		"Token": 0.6, "Embedding": 0.8, "Graph": 0.5,
	}
}

func loadSeedEntities() []domain.Entity {
	// In production, load from DATABASE_URL.
	// For now, return empty — entities loaded via index.Load().
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("no DATABASE_URL set, starting with empty index")
	}
	return nil
}
