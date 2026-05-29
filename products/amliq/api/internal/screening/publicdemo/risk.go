package publicdemo

// RiskLevel maps the highest match confidence to a coarse risk bucket
// per the spec:
//   ≥ 0.85 → "high"
//   ≥ 0.70 → "medium"
//   ≥ 0.40 → "low"
//   else  → "clear"
func RiskLevel(matches []Match) string {
	top := topConfidence(matches)
	switch {
	case top >= 0.85:
		return "high"
	case top >= 0.70:
		return "medium"
	case top >= 0.40:
		return "low"
	default:
		return "clear"
	}
}

func topConfidence(matches []Match) float64 {
	var top float64
	for _, m := range matches {
		if m.Confidence > top {
			top = m.Confidence
		}
	}
	return top
}

// applyThreshold drops matches below `threshold`. Threshold ≤ 0 is a
// no-op (the spec says it's optional).
func applyThreshold(matches []Match, threshold float64) []Match {
	if threshold <= 0 {
		return matches
	}
	out := make([]Match, 0, len(matches))
	for _, m := range matches {
		if m.Confidence >= threshold {
			out = append(out, m)
		}
	}
	return out
}
