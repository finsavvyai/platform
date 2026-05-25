package api

import "github.com/aegis-aml/aegis/internal/domain"

// topEntityEntry is the inner aggregation row while we build the
// top-matched-entities histogram. Not exported — only the serialised
// map form escapes the handler.
type topEntityEntry struct {
	id    string
	count int
	conf  float64
}

// buildTopEntities returns up to 10 most-hit entities across the
// tenant's recent screenings, with the max confidence per entity.
func buildTopEntities(s []domain.ScreenResponse) []map[string]interface{} {
	seen := make(map[string]*topEntityEntry)
	for _, sc := range s {
		for _, m := range sc.Matches {
			id := m.EntityID.String()
			e, ok := seen[id]
			if !ok {
				seen[id] = &topEntityEntry{id, 1, m.Confidence.Score()}
				continue
			}
			e.count++
			if m.Confidence.Score() > e.conf {
				e.conf = m.Confidence.Score()
			}
		}
	}
	result := make([]map[string]interface{}, 0, 10)
	for _, e := range seen {
		result = append(result, map[string]interface{}{
			"name":       e.id,
			"matches":    e.count,
			"confidence": e.conf,
		})
		if len(result) >= 10 {
			break
		}
	}
	return result
}
