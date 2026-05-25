package mcp

import "github.com/aegis-aml/aegis/internal/domain"

func filterByThreshold(
	results []domain.MatchResult, threshold float64,
) []domain.MatchResult {
	if threshold <= 0 {
		return results
	}
	var filtered []domain.MatchResult
	for _, r := range results {
		if r.Confidence.Score() >= threshold {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

func formatResults(results []domain.MatchResult) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(results))
	for _, r := range results {
		layers := make([]map[string]interface{}, 0, len(r.Evidence))
		for _, ev := range r.Evidence {
			layers = append(layers, map[string]interface{}{
				"layer": ev.Layer.String(), "score": ev.Score,
				"algorithm": ev.Algorithm,
			})
		}
		out = append(out, map[string]interface{}{
			"entity_id":  r.EntityID.String(),
			"confidence": r.Confidence.Score(),
			"list_id":    r.ListID,
			"layers":     layers,
			"explain":    r.ExplainChain,
		})
	}
	return out
}

func riskFromMatches(matches []domain.MatchResult) string {
	if len(matches) == 0 {
		return "clear"
	}
	maxConf := 0.0
	for _, m := range matches {
		if m.Confidence.Score() > maxConf {
			maxConf = m.Confidence.Score()
		}
	}
	switch {
	case maxConf >= 0.8:
		return "high"
	case maxConf >= 0.5:
		return "medium"
	default:
		return "low"
	}
}

func buildPEPResponse(
	results []domain.MatchResult, country string,
) map[string]interface{} {
	isPEP := false
	tier := "none"
	position := ""
	associates := []string{}
	for _, r := range results {
		if r.Confidence.Score() > 0.6 {
			isPEP = true
			tier = "potential"
			position = r.ExplainChain
			break
		}
	}
	return map[string]interface{}{
		"is_pep": isPEP, "tier": tier,
		"position": position, "country": country,
		"associates": associates,
	}
}

func txnDecision(
	senderHits, recvHits []domain.MatchResult,
	sRisk, rRisk float64,
) string {
	for _, h := range append(senderHits, recvHits...) {
		if h.Confidence.Score() >= 0.9 {
			return "block"
		}
	}
	if len(senderHits) > 0 || len(recvHits) > 0 || sRisk > 0.5 || rRisk > 0.5 {
		return "review"
	}
	return "allow"
}
