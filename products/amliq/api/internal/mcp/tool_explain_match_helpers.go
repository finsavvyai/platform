package mcp

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// pickExplainTarget returns the match to explain. If entityID is set,
// it filters to that entity; otherwise it returns the top result.
func pickExplainTarget(
	results []domain.MatchResult, entityID string,
) *domain.MatchResult {
	if entityID != "" {
		for i := range results {
			if results[i].EntityID.String() == entityID {
				return &results[i]
			}
		}
		return nil
	}
	if len(results) == 0 {
		return nil
	}
	return &results[0]
}

// buildExplainResponse renders the full evidence cascade plus the
// recommended disposition for an explain_match call.
func buildExplainResponse(r domain.MatchResult) map[string]interface{} {
	layers := make([]map[string]interface{}, 0, len(r.Evidence))
	for _, ev := range r.Evidence {
		layers = append(layers, map[string]interface{}{
			"layer":         ev.Layer.String(),
			"algorithm":     ev.Algorithm,
			"score":         ev.Score,
			"weight":        ev.Weight,
			"matched_value": ev.MatchedValue,
			"input_query":   ev.InputQuery,
			"explanation":   ev.Explanation,
		})
	}
	return map[string]interface{}{
		"matched":                 true,
		"entity_id":               r.EntityID.String(),
		"list_id":                 r.ListID,
		"confidence":              r.Confidence.Score(),
		"disposition":             r.Disposition.String(),
		"layers":                  layers,
		"explain_chain":           r.ExplainChain,
		"recommended_disposition": r.Disposition.String(),
		"rationale":               composeRationale(r),
	}
}

// composeRationale renders a one-paragraph natural-language summary
// suitable for pasting into a compliance memo.
func composeRationale(r domain.MatchResult) string {
	if len(r.Evidence) == 0 {
		return fmt.Sprintf(
			"Match against %s on list %s with %.0f%% confidence.",
			r.EntityID.String(), r.ListID, r.Confidence.Score()*100)
	}
	bits := make([]string, 0, len(r.Evidence))
	for _, ev := range r.Evidence {
		bits = append(bits, fmt.Sprintf(
			"%s layer (%s) scored %.2f on %q",
			ev.Layer.String(), ev.Algorithm, ev.Score, ev.MatchedValue))
	}
	return fmt.Sprintf(
		"%.0f%% confidence match on list %s. Evidence: %s.",
		r.Confidence.Score()*100, r.ListID, strings.Join(bits, "; "))
}
