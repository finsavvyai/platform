package screening

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type EmbeddingMatcher struct {
	vectorCache map[string][]float64
}

func NewEmbeddingMatcher() *EmbeddingMatcher {
	return &EmbeddingMatcher{
		vectorCache: make(map[string][]float64),
	}
}

func (em *EmbeddingMatcher) SetVector(name string, vector []float64) {
	em.vectorCache[name] = vector
}

func (em *EmbeddingMatcher) Match(
	query domain.Name,
	candidates []domain.Name,
) []domain.MatchEvidence {
	queryVec, exists := em.vectorCache[query.Full]
	if !exists {
		return []domain.MatchEvidence{}
	}

	var evidence []domain.MatchEvidence
	for _, candidate := range candidates {
		candVec, exists := em.vectorCache[candidate.Full]
		if !exists {
			continue
		}

		score := cosineSimilarity(queryVec, candVec)
		if score > 0.75 {
			ev := domain.NewMatchEvidence(
				domain.MatchLayerEmbedding,
				"cosine",
				score,
				0.7,
				query.Full,
				candidate.Full,
				"Vector embedding cosine similarity",
			)
			evidence = append(evidence, ev)
		}
	}
	return evidence
}
