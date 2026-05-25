package agent

import (
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

// screening_opts returns default search options for batch scanning.
func screening_opts() screening.SearchOpts {
	return screening.SearchOpts{Limit: 10}
}

func toMatchDetail(m domain.MatchResult) MatchDetail {
	return MatchDetail{
		EntityID:   m.EntityID.String(),
		ListID:     m.ListID,
		Confidence: m.Confidence.Score(),
	}
}

func riskLevel(matches []domain.MatchResult) string {
	best := 0.0
	for _, m := range matches {
		if s := m.Confidence.Score(); s > best {
			best = s
		}
	}
	switch {
	case best >= 0.9:
		return "critical"
	case best >= 0.7:
		return "high"
	default:
		return "medium"
	}
}
