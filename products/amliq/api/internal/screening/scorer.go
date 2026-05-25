package screening

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type WeightedScorer struct {
	weights map[string]float64
}

func NewWeightedScorer(weights map[string]float64) *WeightedScorer {
	if weights == nil {
		weights = make(map[string]float64)
	}
	return &WeightedScorer{weights: weights}
}

func (ws *WeightedScorer) Score(evidence []domain.MatchEvidence) (float64, error) {
	if len(evidence) == 0 {
		return 0.0, nil
	}

	totalWeighted := 0.0
	totalWeight := 0.0

	for _, ev := range evidence {
		weight := ws.weights[ev.Layer.String()]
		if weight == 0 {
			weight = 0.5
		}
		totalWeighted += ev.Score * weight
		totalWeight += weight
	}

	if totalWeight == 0 {
		return 0.0, nil
	}

	score := totalWeighted / totalWeight
	if score > 1.0 {
		score = 1.0
	}
	return score, nil
}

func (ws *WeightedScorer) SetWeight(layer string, weight float64) {
	ws.weights[layer] = weight
}
