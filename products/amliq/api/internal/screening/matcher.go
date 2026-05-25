package screening

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type Matcher interface {
	Match(query domain.Name, candidates []domain.Name) []domain.MatchEvidence
}

type MatcherConfig struct {
	Threshold float64
	Algorithm string
}
