package api

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func filterCandidatesByLists(
	candidates []domain.Entity, lists []string,
) []domain.Entity {
	if len(lists) == 0 {
		return candidates
	}
	m := make(map[string]bool, len(lists))
	for _, l := range lists {
		m[l] = true
	}
	var out []domain.Entity
	for _, c := range candidates {
		if matchesListPrefix(c.ListID, m) {
			out = append(out, c)
		}
	}
	return out
}

func matchesListPrefix(listID string, allowed map[string]bool) bool {
	lid := strings.ToLower(listID)
	for prefix := range allowed {
		if strings.HasPrefix(lid, strings.ToLower(prefix)) {
			return true
		}
	}
	return false
}

func buildDemoQueryEntity(name string) domain.Entity {
	qn, _ := domain.NewName(name, "", "", "")
	eid, _ := domain.NewEntityID("ent_query0000000")
	e, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{qn})
	return e
}

func buildDemoResponse(
	query string,
	matches []domain.MatchResult,
	elapsedMs int64,
	candidates ...[]domain.Entity,
) map[string]interface{} {
	var entityMap map[string]domain.Entity
	if len(candidates) > 0 {
		entityMap = make(map[string]domain.Entity, len(candidates[0]))
		for _, e := range candidates[0] {
			entityMap[e.ID.String()] = e
		}
	}
	items := make([]map[string]interface{}, 0, len(matches))
	for _, m := range matches {
		items = append(items, matchToDetailMap(m, entityMap))
	}
	return map[string]interface{}{
		"query":              query,
		"total_matches":      len(matches),
		"processing_time_ms": elapsedMs,
		"matches":            items,
		"available_lists":    availableLists(),
	}
}

func matchToDetailMap(m domain.MatchResult, entityMap map[string]domain.Entity) map[string]interface{} {
	layers := make([]map[string]interface{}, 0, len(m.Evidence))
	for _, ev := range m.Evidence {
		layers = append(layers, map[string]interface{}{
			"layer":       ev.Layer.String(),
			"score":       ev.Score,
			"algorithm":   ev.Algorithm,
			"matched":     ev.MatchedValue,
			"explanation": ev.Explanation,
			"weight":      ev.Weight,
		})
	}
	result := map[string]interface{}{
		"entity_id":   m.EntityID.String(),
		"entity_name": nameFromEvidence(m.Evidence),
		"list_id":     m.ListID,
		"confidence":  m.Confidence.Score(),
		"disposition": m.Disposition.String(),
		"layers":      layers,
		"explanation": m.ExplainChain,
	}
	if ent, ok := entityMap[m.EntityID.String()]; ok {
		enrichMatchResult(result, ent)
	}
	return result
}

func nameFromEvidence(ev []domain.MatchEvidence) string {
	if len(ev) > 0 {
		return ev[0].MatchedValue
	}
	return ""
}

func availableLists() []string {
	return []string{
		"OFAC", "EU", "UN", "UKOFSI", "SECO",
		"IsraeliMoD", "SDFM", "NBCTF",
	}
}
