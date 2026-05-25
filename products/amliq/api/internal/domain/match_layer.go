package domain

import "fmt"

type MatchLayer int

const (
	MatchLayerUnknown MatchLayer = iota
	MatchLayerExact
	MatchLayerFuzzy
	MatchLayerPhonetic
	MatchLayerToken
	MatchLayerEmbedding
	MatchLayerGraph
)

func (ml MatchLayer) String() string {
	switch ml {
	case MatchLayerExact:
		return "Exact"
	case MatchLayerFuzzy:
		return "Fuzzy"
	case MatchLayerPhonetic:
		return "Phonetic"
	case MatchLayerToken:
		return "Token"
	case MatchLayerEmbedding:
		return "Embedding"
	case MatchLayerGraph:
		return "Graph"
	default:
		return "Unknown"
	}
}

func ParseMatchLayer(s string) (MatchLayer, error) {
	switch s {
	case "Exact":
		return MatchLayerExact, nil
	case "Fuzzy":
		return MatchLayerFuzzy, nil
	case "Phonetic":
		return MatchLayerPhonetic, nil
	case "Token":
		return MatchLayerToken, nil
	case "Embedding":
		return MatchLayerEmbedding, nil
	case "Graph":
		return MatchLayerGraph, nil
	default:
		return MatchLayerUnknown, fmt.Errorf("invalid match layer: %s", s)
	}
}
