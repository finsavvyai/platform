package domain

import "fmt"

// MatchWeights holds normalized scoring weights (must sum to 100).
type MatchWeights struct {
	Exact     float64 `json:"exact"`
	Fuzzy     float64 `json:"fuzzy"`
	Phonetic  float64 `json:"phonetic"`
	Token     float64 `json:"token"`
	Embedding float64 `json:"embedding"`
	Graph     float64 `json:"graph"`
}

// NewMatchWeights creates a validated weight configuration.
func NewMatchWeights(exact, fuzzy, phonetic, token, embedding, graph float64) (MatchWeights, error) {
	mw := MatchWeights{
		Exact:     exact,
		Fuzzy:     fuzzy,
		Phonetic:  phonetic,
		Token:     token,
		Embedding: embedding,
		Graph:     graph,
	}
	return mw, mw.Validate()
}

// Validate checks that weights sum to 100 and are non-negative.
func (mw MatchWeights) Validate() error {
	sum := mw.Sum()
	if sum < 99.9 || sum > 100.1 {
		return fmt.Errorf("weights must sum to 100, got %.1f", sum)
	}
	if mw.Exact < 0 || mw.Fuzzy < 0 || mw.Phonetic < 0 ||
		mw.Token < 0 || mw.Embedding < 0 || mw.Graph < 0 {
		return fmt.Errorf("weights must be non-negative")
	}
	return nil
}

// Sum returns the total of all weights.
func (mw MatchWeights) Sum() float64 {
	return mw.Exact + mw.Fuzzy + mw.Phonetic + mw.Token + mw.Embedding + mw.Graph
}

// DefaultMatchWeights returns sensible defaults that sum to 100.
func DefaultMatchWeights() MatchWeights {
	return MatchWeights{
		Exact:     25.0,
		Fuzzy:     20.0,
		Phonetic:  15.0,
		Token:     15.0,
		Embedding: 17.5,
		Graph:     7.5,
	}
}
