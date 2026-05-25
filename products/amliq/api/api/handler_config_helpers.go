package api

import "github.com/aegis-aml/aegis/internal/domain"

func parseMatchWeights(
	raw map[string]interface{}, current domain.MatchWeights,
) domain.MatchWeights {
	if v, ok := raw["exact"].(float64); ok {
		current.Exact = v
	}
	if v, ok := raw["fuzzy"].(float64); ok {
		current.Fuzzy = v
	}
	if v, ok := raw["phonetic"].(float64); ok {
		current.Phonetic = v
	}
	if v, ok := raw["token"].(float64); ok {
		current.Token = v
	}
	if v, ok := raw["embedding"].(float64); ok {
		current.Embedding = v
	}
	if v, ok := raw["graph"].(float64); ok {
		current.Graph = v
	}
	return current
}
