package agent

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/screening"
)

func deltaScreenOne(
	eng *screening.Engine, cust CustomerRecord, removed map[string]bool,
) []DeltaResult {
	var out []DeltaResult
	matches, err := eng.ScreenByName(cust.Name, screening.SearchOpts{Limit: 10})
	if err == nil {
		for _, m := range matches {
			out = append(out, DeltaResult{
				CustomerID: cust.ID, Action: ActionNewMatch,
				Detail: toMatchDetail(m),
			})
		}
	}
	for id := range removed {
		if strings.EqualFold(cust.ID, id) {
			out = append(out, DeltaResult{
				CustomerID: cust.ID, Action: ActionRemoved,
				Detail: MatchDetail{EntityID: id},
			})
		}
	}
	return out
}

func toSet(ids []string) map[string]bool {
	m := make(map[string]bool, len(ids))
	for _, id := range ids {
		m[id] = true
	}
	return m
}
