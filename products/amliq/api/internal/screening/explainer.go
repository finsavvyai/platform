package screening

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

type Explainer struct{}

func NewExplainer() *Explainer {
	return &Explainer{}
}

func (e *Explainer) Explain(evidence []domain.MatchEvidence) string {
	if len(evidence) == 0 {
		return "No evidence found"
	}

	var parts []string
	for i, ev := range evidence {
		part := formatEvidence(i+1, ev)
		parts = append(parts, part)
	}

	return "Evidence chain:\n" + strings.Join(parts, "\n")
}

func (e *Explainer) SummaryLine(evidence []domain.MatchEvidence) string {
	if len(evidence) == 0 {
		return "No evidence"
	}
	maxScore := 0.0
	for _, ev := range evidence {
		if ev.Score > maxScore {
			maxScore = ev.Score
		}
	}
	return fmt.Sprintf("Match confidence %.2f from %d evidence sources", maxScore, len(evidence))
}

func formatEvidence(idx int, ev domain.MatchEvidence) string {
	switch ev.Layer {
	case domain.MatchLayerEmbedding:
		return fmt.Sprintf(
			"[%d] Semantic similarity: %.0f%% ('%s' ↔ '%s', cross-language match)",
			idx, ev.Score*100, ev.InputQuery, ev.MatchedValue,
		)
	case domain.MatchLayerGraph:
		return fmt.Sprintf(
			"[%d] Graph: '%s' related to '%s' (%.2f confidence, %s)",
			idx, ev.InputQuery, ev.MatchedValue, ev.Score, ev.Algorithm,
		)
	default:
		return fmt.Sprintf(
			"[%d] %s: '%s' vs '%s' (%.2f score, %s)",
			idx, ev.Layer.String(), ev.InputQuery, ev.MatchedValue,
			ev.Score, ev.Algorithm,
		)
	}
}
