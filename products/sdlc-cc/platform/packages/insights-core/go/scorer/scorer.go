package scorer

import (
	"github.com/sdlc-ai/platform/packages/insights-core/types"
)

// Scorer is a pure function; no I/O. Full impl lands in T-101.
type Scorer struct {
	Weights types.Weights
}

func New(w types.Weights) *Scorer { return &Scorer{Weights: w} }

// Score is a placeholder returning the weighted sum of the supplied breakdown
// clamped to [0,1]. T-101 replaces with the full formula + property tests.
func (s *Scorer) Score(b types.ScoreBreakdown) float64 {
	v := s.Weights.SOC2*b.SOC2 +
		s.Weights.HIPAA*b.HIPAA +
		s.Weights.GDPR*b.GDPR +
		s.Weights.Cost*b.Cost +
		s.Weights.Blast*b.Blast
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}
