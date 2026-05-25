package domain

import "fmt"

type Confidence struct {
	score float64
}

func NewConfidence(score float64) (Confidence, error) {
	if score < 0.0 || score > 1.0 {
		return Confidence{}, fmt.Errorf("confidence must be 0.0-1.0, got %f", score)
	}
	return Confidence{score: score}, nil
}

func (c Confidence) Score() float64 {
	return c.score
}

func (c Confidence) IsAbove(threshold float64) bool {
	return c.score > threshold
}

func (c Confidence) Level() string {
	switch {
	case c.score >= 0.8:
		return "High"
	case c.score >= 0.5:
		return "Medium"
	default:
		return "Low"
	}
}

func (c Confidence) String() string {
	return fmt.Sprintf("%.2f", c.score)
}
