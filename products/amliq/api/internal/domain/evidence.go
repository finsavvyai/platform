package domain

import "time"

type MatchEvidence struct {
	Layer            MatchLayer
	Algorithm        string
	Score            float64
	Weight           float64
	InputQuery       string
	MatchedValue     string
	Explanation      string
	TimestampMatched time.Time
}

func NewMatchEvidence(
	layer MatchLayer,
	algo string,
	score float64,
	weight float64,
	query string,
	matched string,
	explanation string,
) MatchEvidence {
	return MatchEvidence{
		Layer:            layer,
		Algorithm:        algo,
		Score:            score,
		Weight:           weight,
		InputQuery:       query,
		MatchedValue:     matched,
		Explanation:      explanation,
		TimestampMatched: time.Now().UTC(),
	}
}

func (me MatchEvidence) WeightedScore() float64 {
	return me.Score * me.Weight
}

func (me MatchEvidence) String() string {
	return me.Layer.String() + ": " + me.MatchedValue
}
