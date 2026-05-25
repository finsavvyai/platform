package api

import "github.com/aegis-aml/aegis/internal/domain"

func buildMatchItems(matches []domain.MatchResult) []map[string]interface{} {
	items := make([]map[string]interface{}, 0, len(matches))
	for _, m := range matches {
		items = append(items, map[string]interface{}{
			"id":         m.EntityID.String(),
			"listName":   m.ListID,
			"listSource": m.ListID,
			"confidence": m.Confidence.Score(),
			"riskLevel":  riskLevelFromDisposition(m.Disposition),
			"evidence":   buildEvidenceItems(m.Evidence),
			"createdAt":  m.TimestampHit.Format("2006-01-02T15:04:05Z"),
		})
	}
	return items
}

func riskLevelFromDisposition(d domain.Disposition) string {
	switch d {
	case domain.DispositionAutoEscalate:
		return "critical"
	case domain.DispositionReview:
		return "high"
	case domain.DispositionAutoClear:
		return "low"
	default:
		return "medium"
	}
}

func buildEvidenceItems(
	evidence []domain.MatchEvidence,
) []map[string]interface{} {
	items := make([]map[string]interface{}, 0, len(evidence))
	for _, ev := range evidence {
		items = append(items, map[string]interface{}{
			"type":    ev.Layer.String(),
			"score":   ev.Score,
			"details": ev.MatchedValue,
		})
	}
	return items
}
